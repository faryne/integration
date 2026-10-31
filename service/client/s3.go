package client

import (
	"context"
	"fmt"

	"faryne.dev/config"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// NewS3Client 用共用的 S3_ACCESS_KEY／S3_SECRET_KEY／S3_REGION 建 client。
// 各服務原本各自寫一份同樣的建立流程（taipower、twse、vtuber…），新程式改用這裡，舊的之後再收斂
func NewS3Client(ctx context.Context) (*s3.Client, error) {
	cfg := config.EnvConfig()
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}
	return s3.NewFromConfig(awsCfg), nil
}

// S3Bucket 共用的 S3_BUCKET（公開檔案走 CDN_URL／VITE_CDN_BASE 讀取）
func S3Bucket() *string {
	return aws.String(config.EnvConfig().S3Bucket)
}
