package nekomaid

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"faryne.dev/config"
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	repo "faryne.dev/repository/nekomaid"
	"github.com/aws/aws-sdk-go-v2/aws"
	s3config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/disintegration/imaging"
)

const Home = "https://beta.faryne.dev"
const PreviewUrlPattern = Home + "/nekomaid/%s/%s/%s"

var domains = []string{
	"https://pcdn1.ha2.tw",
	"https://pcdn2.ha2.tw",
	"https://cdn-pixiv.maid.tw",
	"https://cdn-pixiv.maid.im",
}

// RetrieverInterface 作為介面控制需實作的項目
type RetrieverInterface interface {
	// Login 執行登入
	Login() error
	Get(id string) (*nekomaid.ArtworkMain, error)
}

func UploadImage(site enum.NekomaidSite, authorId, artworkId string, reader *http.Response, idx int) (nekomaid.ArtworkPhoto, string, error) {
	var o = nekomaid.ArtworkPhoto{}
	var thumb = "" // 縮圖網址

	// 這裡先讀取 body 到 buffer，因為我們需要重複讀取 (Decode, MD5, S3 upload)
	data, err := io.ReadAll(reader.Body)
	if err != nil {
		return o, thumb, err
	}

	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return o, thumb, err
	}

	// 將 image 物件轉換為 bytes，並且算出 hashId
	b := new(bytes.Buffer)
	// 解出副檔名
	o.Ext = format
	if strings.ToLower(format) == "jpeg" { // 碰到是 jpeg 時，副檔名改為 jpg
		o.Ext = "jpg"
		if err := jpeg.Encode(b, img, &jpeg.Options{Quality: 80}); err != nil {
			return o, thumb, err
		}
	} else if strings.ToLower(format) == "png" {
		if err := png.Encode(b, img); err != nil {
			return o, thumb, err
		}
	} else {
		// 其他格式 (如 gif) 直接寫回 buffer 或處理
		b.Write(data)
	}

	m := md5.New()
	m.Write(b.Bytes())
	hashId := hex.EncodeToString(m.Sum(nil))[0:5]

	o.Size = int(int64(b.Len()))
	o.Height = img.Bounds().Dy()
	o.Width = img.Bounds().Dx()
	o.Mime = http.DetectContentType(b.Bytes())
	o.Index = idx
	o.FileId = artworkId
	o.KeyId = hashId

	// 處理 Raw 的網址內容，避免重要資訊暴露
	imageUrl, _ := url.Parse(reader.Request.URL.String())
	values := imageUrl.Query()
	values.Del("api_key")
	imageUrl.RawQuery = values.Encode()
	o.Raw = imageUrl.String()
	o.Original = o.Raw

	cfg := config.EnvConfig()
	// s3 client
	s3creds := credentials.NewStaticCredentialsProvider(cfg.NekomaidS3Key, cfg.NekomaidS3Secret, "")
	s3cfg, _ := s3config.LoadDefaultConfig(context.TODO(),
		s3config.WithRegion(cfg.S3Region),
		s3config.WithCredentialsProvider(s3creds),
	)
	s3Client := s3.NewFromConfig(s3cfg)

	// 處理縮圖
	if idx == 0 {
		thumbFilename := fmt.Sprintf("%s_%s_thumb.%s", artworkId, hashId, o.Ext)
		thumbKey := nekomaidThumbObjectKey(site, authorId, thumbFilename)
		thumb = getDomain() + "/" + thumbKey // 設定縮圖完整網址
		var width, height = 120, 0
		if img.Bounds().Dx() < img.Bounds().Dy() {
			width = 0
			height = 120
		}
		newImage := imaging.Resize(img, width, height, imaging.Lanczos)

		var thumbBytes = new(bytes.Buffer)
		if o.Ext == "jpg" {
			jpeg.Encode(thumbBytes, newImage, nil)
		} else {
			png.Encode(thumbBytes, newImage)
		}

		_, err := s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
			Bucket:      aws.String(cfg.NekomaidBucket),
			Key:         aws.String(thumbKey),
			Body:        bytes.NewReader(thumbBytes.Bytes()),
			ContentType: aws.String(http.DetectContentType(thumbBytes.Bytes())),
			ACL:         types.ObjectCannedACLPublicRead,
		})
		if err != nil {
			return o, thumb, fmt.Errorf("failed to upload thumbnail to s3: %w", err)
		}
	}

	// 計算圖片真實路徑
	filenamePattern := "%s_%s.%s"
	var filename = fmt.Sprintf(filenamePattern, artworkId, o.KeyId, o.Ext)
	if idx > 0 {
		filename = fmt.Sprintf(filenamePattern, artworkId, o.KeyId+"_p"+strconv.Itoa(idx), o.Ext)
	}
	objectKey := nekomaidObjectKey(site, authorId, filename)
	o.Filename = objectKey
	o.Url = getDomain() + "/" + objectKey

	_, err = s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(cfg.NekomaidBucket),
		Key:         aws.String(objectKey),
		Body:        bytes.NewReader(b.Bytes()),
		ContentType: aws.String(o.Mime),
		ACL:         types.ObjectCannedACLPublicRead,
	})
	if err != nil {
		// 如果主圖片上傳失敗，且如果已經上傳了縮圖，這裡可能需要考慮是否要刪除縮圖
		// 但為了簡化，我們先回傳錯誤，讓外層的 RetrieveAndSave 統一處理清理邏輯
		return o, thumb, fmt.Errorf("failed to upload main image to s3: %w", err)
	}

	return o, thumb, nil
}

func nekomaidObjectKey(site enum.NekomaidSite, authorId, filename string) string {
	return strings.Join([]string{
		cleanS3PathSegment(string(site)),
		cleanS3PathSegment(authorId),
		cleanS3PathSegment(filename),
	}, "/")
}

func nekomaidThumbObjectKey(site enum.NekomaidSite, authorId, filename string) string {
	return strings.Join([]string{
		"thumb",
		cleanS3PathSegment(string(site)),
		cleanS3PathSegment(authorId),
		cleanS3PathSegment(filename),
	}, "/")
}

func ugoiraObjectKey(site enum.NekomaidSite, artworkId, filename string) string {
	return strings.Join([]string{
		"ugoira",
		cleanS3PathSegment(string(site)),
		cleanS3PathSegment(artworkId),
		cleanS3PathSegment(filename),
	}, "/")
}

func cleanS3PathSegment(segment string) string {
	segment = strings.TrimSpace(strings.Trim(segment, "/"))
	segment = strings.ReplaceAll(segment, "/", "_")
	if segment == "" {
		return "_"
	}
	return segment
}

func s3KeyFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return strings.TrimPrefix(u.EscapedPath(), "/")
}

func UploadUgoira(site enum.NekomaidSite, artworkId string, webmData, zipData []byte, preview image.Image, rawURL string) (nekomaid.ArtworkPhoto, string, error) {
	var o = nekomaid.ArtworkPhoto{}
	var thumb string
	if len(webmData) == 0 {
		return o, thumb, fmt.Errorf("ugoira webm data is empty")
	}
	if len(zipData) == 0 {
		return o, thumb, fmt.Errorf("ugoira zip data is empty")
	}
	if preview == nil {
		return o, thumb, fmt.Errorf("ugoira preview image is nil")
	}

	m := md5.New()
	m.Write(webmData)
	hashId := hex.EncodeToString(m.Sum(nil))[0:5]

	cfg := config.EnvConfig()
	s3creds := credentials.NewStaticCredentialsProvider(cfg.NekomaidS3Key, cfg.NekomaidS3Secret, "")
	s3cfg, _ := s3config.LoadDefaultConfig(context.TODO(),
		s3config.WithRegion(cfg.S3Region),
		s3config.WithCredentialsProvider(s3creds),
	)
	s3Client := s3.NewFromConfig(s3cfg)

	webmKey := ugoiraObjectKey(site, artworkId, fmt.Sprintf("%s_%s.webm", artworkId, hashId))
	zipKey := ugoiraObjectKey(site, artworkId, fmt.Sprintf("%s_%s.zip", artworkId, hashId))
	thumbKey := nekomaidThumbObjectKey(site, artworkId, fmt.Sprintf("%s_%s_thumb.png", artworkId, hashId))
	domain := getDomain()

	newImage := imaging.Resize(preview, 120, 0, imaging.Lanczos)
	if preview.Bounds().Dx() < preview.Bounds().Dy() {
		newImage = imaging.Resize(preview, 0, 120, imaging.Lanczos)
	}
	var thumbBytes bytes.Buffer
	if err := png.Encode(&thumbBytes, newImage); err != nil {
		return o, thumb, err
	}

	if _, err := s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(cfg.NekomaidBucket),
		Key:         aws.String(thumbKey),
		Body:        bytes.NewReader(thumbBytes.Bytes()),
		ContentType: aws.String("image/png"),
		ACL:         types.ObjectCannedACLPublicRead,
	}); err != nil {
		return o, thumb, fmt.Errorf("failed to upload ugoira thumbnail to s3: %w", err)
	}
	thumb = domain + "/" + thumbKey

	if _, err := s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(cfg.NekomaidBucket),
		Key:         aws.String(zipKey),
		Body:        bytes.NewReader(zipData),
		ContentType: aws.String("application/zip"),
		ACL:         types.ObjectCannedACLPublicRead,
	}); err != nil {
		return o, thumb, fmt.Errorf("failed to upload ugoira zip to s3: %w", err)
	}

	if _, err := s3Client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(cfg.NekomaidBucket),
		Key:         aws.String(webmKey),
		Body:        bytes.NewReader(webmData),
		ContentType: aws.String("video/webm"),
		ACL:         types.ObjectCannedACLPublicRead,
	}); err != nil {
		return o, thumb, fmt.Errorf("failed to upload ugoira webm to s3: %w", err)
	}

	raw, _ := url.Parse(rawURL)
	if raw != nil {
		values := raw.Query()
		values.Del("api_key")
		raw.RawQuery = values.Encode()
		o.Raw = raw.String()
	}

	o.Ext = "webm"
	o.FileId = artworkId
	o.Filename = webmKey
	o.Height = preview.Bounds().Dy()
	o.Index = 0
	o.KeyId = hashId
	o.Mime = "video/webm"
	o.Original = domain + "/" + zipKey
	o.Size = len(webmData)
	o.Url = domain + "/" + webmKey
	o.Width = preview.Bounds().Dx()

	return o, thumb, nil
}

func DeleteImages(ctx context.Context, photos []nekomaid.ArtworkPhoto, thumb string) {
	cfg := config.EnvConfig()
	s3creds := credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, "")
	s3cfg, _ := s3config.LoadDefaultConfig(ctx,
		s3config.WithRegion(cfg.S3Region),
		s3config.WithCredentialsProvider(s3creds),
	)
	s3Client := s3.NewFromConfig(s3cfg)

	// 刪除主圖片
	for _, p := range photos {
		if p.Filename != "" {
			_, _ = s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
				Bucket: aws.String(cfg.NekomaidBucket),
				Key:    aws.String(p.Filename),
			})
		}
		if originalKey := s3KeyFromURL(p.Original); strings.HasPrefix(originalKey, "ugoira/") {
			_, _ = s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
				Bucket: aws.String(cfg.NekomaidBucket),
				Key:    aws.String(originalKey),
			})
		}
	}

	// 刪除縮圖
	if thumb != "" {
		thumbKey := s3KeyFromURL(thumb)
		if thumbKey != "" {
			_, _ = s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
				Bucket: aws.String(cfg.NekomaidBucket),
				Key:    aws.String(thumbKey),
			})
		}
	}
}

func getDomain() string {
	return domains[rand.Intn(len(domains))]
}

type Retriever struct {
	repository *repo.NekomaidRepository
}

func NewRetriever() *Retriever {
	return &Retriever{
		repository: repo.NewNekomaidRepository(),
	}
}

func (r *Retriever) RetrieveAndSave(ctx context.Context, site enum.NekomaidSite, artworkId string, retriever RetrieverInterface) (string, error) {
	// 1. 執行抓取 (此時會觸發 UploadImage)
	artwork, err := retriever.Get(artworkId)
	if err != nil {
		return "", err
	}

	// 如果抓取成功但有圖片，準備清理邏輯
	cleanup := func() {
		DeleteImages(ctx, artwork.FullContent.Photos, artwork.FullContent.Thumb)
	}

	// 2. 判斷是否抓過
	exists, err := r.repository.CheckExists(site, artwork.AuthorId, artwork.ArtworkId)
	if err != nil {
		cleanup()
		return "", err
	}
	if exists {
		cleanup()
		return "", fmt.Errorf("此作品已被抓取過")
	}

	// 3. 判斷是否為不能抓取的項目
	forbidden, err := r.repository.CheckForbidden(site, artwork.AuthorId)
	if err != nil {
		cleanup()
		return "", err
	}
	if forbidden {
		cleanup()
		return "", fmt.Errorf("此畫師的作品不允許被抓取")
	}

	// 4. 更新畫師暱稱
	if err := r.repository.UpdateAuthorNickname(site, artwork.AuthorId, artwork.FullContent.Author); err != nil {
		cleanup()
		return "", fmt.Errorf("failed to update author nickname: %w", err)
	}

	// 5. 儲存作品資料
	if err := r.repository.SaveArtwork(artwork); err != nil {
		cleanup()
		return "", fmt.Errorf("failed to save artwork: %w", err)
	}

	return artwork.FullContent.PreviewUrl, nil
}
