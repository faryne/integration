package av

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"os"
	"path/filepath"
	"strings"
	"time"

	"faryne.dev/config"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"faryne.dev/service/telegram"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"
)

const (
	// actressTopicsPrefix S3 上的路徑，前端用 VITE_CDN_BASE 加這個前綴讀取
	actressTopicsPrefix = "opendata/av/actress-topics"
	// actressTopicsLocalDir 非 production 改寫到本機（相對於執行目錄），方便檢查產出的 JSON
	actressTopicsLocalDir = "tmp/actress-topics"
	actressTopicsIndex    = "index.json"
	actressTopicsTimeout  = 2 * time.Hour
)

// RunActressTopicsCron 每週產生女優主題：全部算完才上傳，任何一步失敗都不覆蓋 S3（前端繼續讀上週的檔案），並發 TG 告警
func RunActressTopicsCron() {
	ctx, cancel := context.WithTimeout(context.Background(), actressTopicsTimeout)
	defer cancel()
	startedAt := time.Now()
	set, err := buildActressTopics(ctx, startedAt)
	if err == nil {
		err = publishActressTopics(ctx, set)
	}
	if err != nil {
		log.Logger().Error("AV actress topics failed: " + err.Error())
		if err := telegram.SendMessage(context.Background(), "<b>AV 女優主題產生失敗</b>\n\n"+html.EscapeString(err.Error())); err != nil {
			log.Logger().Error("AV actress topics alert failed: " + err.Error())
		}
		return
	}
	log.Logger().Info("AV actress topics finished", zap.Int("topics", len(set.Files)), zap.Duration("elapsed", time.Since(startedAt)))

	// 管理列表顯示的「上次人數／產生時間」；回寫失敗不影響已上傳的檔案，只記 log 並告警
	var notes []string
	if err := avRepo.NewActressTopic().SaveResults(set.CustomCounts, startedAt); err != nil {
		notes = append(notes, "回寫自訂主題人數失敗："+err.Error())
	}
	if len(set.Warnings) > 0 {
		notes = append(notes, "略過的自訂主題：\n"+strings.Join(set.Warnings, "\n"))
	}
	if len(notes) > 0 {
		msg := strings.Join(notes, "\n\n")
		log.Logger().Warn("AV actress topics finished with warnings: " + msg)
		if err := telegram.SendMessage(context.Background(), "<b>AV 女優主題產生完成，但有問題</b>\n\n"+html.EscapeString(msg)); err != nil {
			log.Logger().Error("AV actress topics alert failed: " + err.Error())
		}
	}
}

// publishActressTopics production 上傳 S3，其他環境寫本機目錄（本機也會跑排程，不能蓋掉正式的檔案）。
// index.json 最後才寫：中途失敗時主題檔是新的、index 還是舊的，前端仍然讀得到
func publishActressTopics(ctx context.Context, set actressTopicSet) error {
	put, err := actressTopicWriter(ctx)
	if err != nil {
		return err
	}
	for name, file := range set.Files {
		if err := put(name, file); err != nil {
			return err
		}
	}
	return put(actressTopicsIndex, set.Index)
}

// actressTopicWriter 依環境回傳寫檔的方式
func actressTopicWriter(ctx context.Context) (func(name string, v any) error, error) {
	if !config.EnvConfig().IsProduction() {
		if err := os.MkdirAll(actressTopicsLocalDir, 0o755); err != nil {
			return nil, err
		}
		return func(name string, v any) error {
			body, err := json.MarshalIndent(v, "", "  ")
			if err != nil {
				return err
			}
			return os.WriteFile(filepath.Join(actressTopicsLocalDir, name), body, 0o644)
		}, nil
	}
	s3Client, err := client.NewS3Client(ctx)
	if err != nil {
		return nil, err
	}
	return func(name string, v any) error {
		body, err := json.Marshal(v)
		if err != nil {
			return err
		}
		key := actressTopicsPrefix + "/" + name
		if _, err := s3Client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:       client.S3Bucket(),
			Key:          aws.String(key),
			Body:         bytes.NewReader(body),
			ContentType:  aws.String("application/json; charset=utf-8"),
			CacheControl: aws.String("public, max-age=3600"),
		}); err != nil {
			return fmt.Errorf("upload %s: %w", key, err)
		}
		return nil
	}, nil
}
