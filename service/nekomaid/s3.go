package nekomaid

import (
	"context"
	"net/url"
	"slices"
	"strings"

	"faryne.dev/config"
	"faryne.dev/model/entity/nekomaid"
	"github.com/aws/aws-sdk-go-v2/aws"
	s3config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// newS3Client nekomaid bucket 專用的 S3 client；上傳、清理、下架一律用 NEKOMAID_S3_* 這組憑證。
// （以前 DeleteImages 誤用主站的 S3_ACCESS_KEY，抓取失敗時的清理可能根本刪不掉）
func newS3Client(ctx context.Context) *s3.Client {
	cfg := config.EnvConfig()
	s3cfg, _ := s3config.LoadDefaultConfig(ctx,
		s3config.WithRegion(cfg.S3Region),
		s3config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.NekomaidS3Key, cfg.NekomaidS3Secret, "")),
	)
	return s3.NewFromConfig(s3cfg)
}

// DeleteImages 刪除一件作品在 S3 上的所有物件（原圖、ugoira zip、縮圖）；best effort，個別失敗不中斷
func DeleteImages(ctx context.Context, photos []nekomaid.ArtworkPhoto, thumb string) {
	s3Client, bucket := newS3Client(ctx), config.EnvConfig().NekomaidBucket
	for _, key := range artworkObjectKeys(photos, thumb) {
		_, _ = s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)})
	}
}

// artworkObjectKeys 從作品資料收集本站 S3 物件 key（去重）：
// Filename 是新版 Go 寫入的 key；Url／Original／thumb 只取本站 CDN 網域的路徑，
// 舊資料沒有 Filename 時靠 Url 補，Original 指向來源站（pximg 等）的會被略過。
func artworkObjectKeys(photos []nekomaid.ArtworkPhoto, thumb string) []string {
	keys := make([]string, 0, len(photos)*2+1)
	add := func(key string) {
		if key != "" && !slices.Contains(keys, key) {
			keys = append(keys, key)
		}
	}
	for _, p := range photos {
		add(p.Filename)
		add(ownedS3Key(p.Url))
		add(ownedS3Key(p.Original))
	}
	add(ownedS3Key(thumb))
	return keys
}

// ownedS3Key 網址屬於本站 CDN（domains）時回傳 S3 key，否則回空字串
func ownedS3Key(rawURL string) string {
	u, err := url.Parse(strings.Replace(rawURL, "http:", "https:", 1))
	if err != nil || !slices.Contains(domains, u.Scheme+"://"+u.Host) {
		return ""
	}
	return s3KeyFromURL(u.String())
}
