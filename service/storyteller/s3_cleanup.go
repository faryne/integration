package storyteller

import (
	"context"
	"strings"
	"time"

	"faryne.dev/config"
	"faryne.dev/service/log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"
)

const storytellerPendingObjectTagging = "storyteller-pending=true"

// deleteStorytellerPendingObject 在驗證失敗時盡力刪除剛上傳的 pending object；
// 刪除失敗只記錄 warning，不能覆蓋原本的驗證錯誤。
func deleteStorytellerPendingObject(ctx context.Context, client *s3.Client, key string, fields ...zap.Field) {
	key = strings.TrimSpace(key)
	if key == "" {
		return
	}
	if _, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(config.EnvConfig().S3Bucket),
		Key:    aws.String(key),
	}); err != nil {
		log.Logger().Warn("Storyteller pending S3 object delete failed", append(fields,
			zap.String("s3_key", key),
			zap.Error(err),
		)...)
	}
}

// clearStorytellerPendingObjectTag 在內容成功落 DB 後移除 pending tag；
// 清 tag 失敗只記錄 warning，主流程仍照原本結果回傳。
func clearStorytellerPendingObjectTag(ctx context.Context, client *s3.Client, key string, fields ...zap.Field) {
	key = strings.TrimSpace(key)
	if key == "" {
		return
	}
	if _, err := client.DeleteObjectTagging(ctx, &s3.DeleteObjectTaggingInput{
		Bucket: aws.String(config.EnvConfig().S3Bucket),
		Key:    aws.String(key),
	}); err != nil {
		log.Logger().Warn("Storyteller pending S3 object tag clear failed", append(fields,
			zap.String("s3_key", key),
			zap.Error(err),
		)...)
	}
}

// clearImageStoryPendingObjectTags 清除圖像故事內容內所有直接引用 key 的 pending tag。
func clearImageStoryPendingObjectTags(rawContent string, fields ...zap.Field) {
	keys, err := imagePageKeys(rawContent)
	if err != nil {
		log.Logger().Warn("Storyteller image story pending tag clear skipped", append(fields, zap.Error(err))...)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := initS3Client(ctx)
	if err != nil {
		log.Logger().Warn("Storyteller image story pending tag clear S3 init failed", append(fields, zap.Error(err))...)
		return
	}
	for _, key := range uniqueStrings(keys) {
		clearStorytellerPendingObjectTag(ctx, client, key, fields...)
	}
}
