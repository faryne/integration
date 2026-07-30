package storyteller

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"

	"faryne.dev/config"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const (
	// imageUploadPresignTTL 是 presigned PUT 網址的有效期限，給使用者選圖到按下上傳
	// 之間留一點緩衝，太短容易因為使用者選了很多張圖、逐一調整描述而過期。
	imageUploadPresignTTL = 15 * time.Minute
	// imageKeyPrefix 刻意跟 project/episode id 無關，只是固定前綴，避免從 key 本身
	// 猜出這是誰的作品或做流水號枚舉——實際辨識靠亂數本體。
	imageKeyPrefix = "steamloom/"
	// maxImagePagesPerUpload 限制單次 presign 最多能要幾張圖的上傳網址，避免有人
	// 繞過前端直接打這支 API 大量索取 presigned URL 來塞爆 bucket。
	maxImagePagesPerUpload = 60
	// maxImagePageSizeBytes 是單張圖像頁允許的檔案大小上限，在 CreateStory/UpdateStory
	// 儲存 content_type=image 的故事時用 HeadObject 逐一檢查，避免有人繞過前端的
	// 檔案大小限制把 bucket 當免費空間塞大檔案。
	maxImagePageSizeBytes = 15 * 1024 * 1024
)

// allowedImagePageContentTypes 是圖像頁允許的檔案類型白名單，presign 時只接受這些
// content type，並把它綁進 S3 PutObjectInput.ContentType——上傳時瀏覽器送出的
// Content-Type header 若跟 presign 當下宣告的不一致，S3 簽章驗證就會直接擋下來。
var allowedImagePageContentTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

func initS3Client(ctx context.Context) (*s3.Client, error) {
	staticProvider := credentials.NewStaticCredentialsProvider(config.EnvConfig().S3AccessKey, config.EnvConfig().S3SecretKey, "")
	cfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(config.EnvConfig().S3Region),
		awsconfig.WithCredentialsProvider(staticProvider),
	)
	if err != nil {
		return nil, fmt.Errorf("無法載入 AWS 設定: %v", err)
	}
	return s3.NewFromConfig(cfg), nil
}

func randomImageKey() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return ""
	}
	return imageKeyPrefix + time.Now().Format("2006/01/02") + "/" + hex.EncodeToString(buf)
}

// PresignImageUpload 驗證使用者對該專案有權限後，逐一驗證 content type 落在白名單內，
// 產生對應數量、可直接 PUT 上傳的 S3 網址。這一步刻意不綁定到特定的話——建立話跟
// 關聯頁面是 CreateImagePages 那一步的事，這裡只負責「給我可以直接傳去 S3 的網址」。
func (s *Service) PresignImageUpload(ctx context.Context, userID uint64, projectPublicID string, contentTypes []string) ([]storytellerModel.ImagePageUploadOutput, error) {
	if len(contentTypes) <= 0 {
		return nil, fmt.Errorf("content_types must not be empty")
	}
	if len(contentTypes) > maxImagePagesPerUpload {
		return nil, fmt.Errorf("最多一次只能上傳 %d 張圖", maxImagePagesPerUpload)
	}
	for _, contentType := range contentTypes {
		if !allowedImagePageContentTypes[contentType] {
			return nil, fmt.Errorf("不支援的檔案類型: %s", contentType)
		}
	}
	if _, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID); err != nil {
		return nil, err
	}

	client, err := initS3Client(ctx)
	if err != nil {
		return nil, err
	}
	presignClient := s3.NewPresignClient(client)

	outputs := make([]storytellerModel.ImagePageUploadOutput, 0, len(contentTypes))
	for _, contentType := range contentTypes {
		key := randomImageKey()
		request, err := presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(config.EnvConfig().S3Bucket),
			Key:         aws.String(key),
			ContentType: aws.String(contentType),
		}, s3.WithPresignExpires(imageUploadPresignTTL))
		if err != nil {
			return nil, fmt.Errorf("presign upload url: %w", err)
		}
		outputs = append(outputs, storytellerModel.ImagePageUploadOutput{
			Key:       key,
			UploadURL: request.URL,
		})
	}
	return outputs, nil
}

// validateImagePageSizes 用 S3 HeadObject 逐一檢查每個 key 目前實際的檔案大小，在
// CreateStory/UpdateStory 儲存 content_type=image 的故事時呼叫——presigned PUT
// 網址本身不能限制上傳大小，這一步才是真正擋住「繞過前端限制、上傳超大檔案」的關卡。
func validateImagePageSizes(keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	if len(keys) > maxImagePagesPerUpload {
		return fmt.Errorf("最多一次只能有 %d 張圖", maxImagePagesPerUpload)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := initS3Client(ctx)
	if err != nil {
		return err
	}
	for _, key := range keys {
		if key == "" {
			continue
		}
		head, err := client.HeadObject(ctx, &s3.HeadObjectInput{
			Bucket: aws.String(config.EnvConfig().S3Bucket),
			Key:    aws.String(key),
		})
		if err != nil {
			return fmt.Errorf("讀取圖片資訊失敗: %w", err)
		}
		if head.ContentLength != nil && *head.ContentLength > maxImagePageSizeBytes {
			return fmt.Errorf("圖片檔案大小超過上限（%d MB）", maxImagePageSizeBytes/1024/1024)
		}
	}
	return nil
}
