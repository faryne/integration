package taipower

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"faryne.dev/config"
	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	taipowerRepo "faryne.dev/repository/taipower"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type neighborStatisticsManifest struct {
	GenerationID         string            `json:"generation_id"`
	GeneratedAt          time.Time         `json:"generated_at"`
	SourceLatestMonth    string            `json:"source_latest_month"`
	IndexedCount         int64             `json:"indexed_count"`
	NormalizationVersion string            `json:"normalization_version"`
	PurposeRuleVersion   string            `json:"purpose_rule_version"`
	Files                map[string]string `json:"files"`
}

// GenerateNeighborStatisticsFiles 驗證三份統計後才切換 manifest，避免前端讀到半套版本。
func GenerateNeighborStatisticsFiles() error {
	ctx := context.Background()
	dbSummary, err := taipowerRepo.NewNeighborRepository().Summary()
	if err != nil {
		return fmt.Errorf("mysql neighbor summary: %w", err)
	}
	indexSummary, err := neighborIndexSummary(ctx, neighborIndexName)
	if err != nil {
		return err
	}
	if err := validateNeighborSummaries(dbSummary, indexSummary); err != nil {
		return err
	}

	cityArea, err := NeighborStatistics("cityarea")
	if err != nil {
		return err
	}
	unit, err := NeighborStatistics("unit")
	if err != nil {
		return err
	}
	purpose, err := NeighborPurposeStatistics()
	if err != nil {
		return err
	}
	if err := validateNeighborStatistics(indexSummary, cityArea, unit, purpose); err != nil {
		return err
	}

	generatedAt := time.Now().UTC()
	cityArea.GeneratedAt, unit.GeneratedAt, purpose.GeneratedAt = generatedAt, generatedAt, generatedAt
	generationID := generatedAt.Format("20060102T150405.000000000Z")
	files := map[string]string{}
	contents := map[string]any{"cityarea": cityArea, "unit": unit, "purpose": purpose}
	for name := range contents {
		files[name] = fmt.Sprintf("%s/versions/%s/%s.json", statisticsObjectPrefix, generationID, name)
	}
	manifest := neighborStatisticsManifest{
		GenerationID: generationID, GeneratedAt: generatedAt,
		SourceLatestMonth: formatNeighborYearMonth(indexSummary.LatestMonth), IndexedCount: indexSummary.Count,
		NormalizationVersion: neighborNormalizationVersion, PurposeRuleVersion: neighborPurposeRuleVersion, Files: files,
	}
	s3Client, err := newStatisticsS3Client(ctx)
	if err != nil {
		return err
	}
	return publishNeighborFiles(contents, manifest, func(key string, content []byte, cacheControl string) error {
		return uploadNeighborJSON(ctx, s3Client, key, content, cacheControl)
	})
}

// publishNeighborFiles 最後才寫 manifest；任何統計檔失敗都保留既有發布版本。
func publishNeighborFiles(contents map[string]any, manifest neighborStatisticsManifest, upload func(string, []byte, string) error) error {
	for _, name := range []string{"cityarea", "unit", "purpose"} {
		content, err := json.Marshal(contents[name])
		if err != nil {
			return err
		}
		if err := upload(manifest.Files[name], content, "public, max-age=31536000, immutable"); err != nil {
			return err
		}
	}
	content, err := json.Marshal(manifest)
	if err != nil {
		return err
	}
	return upload(statisticsObjectPrefix+"/manifest.json", content, "public, max-age=60")
}

func validateNeighborSummaries(db, index taipowerRepo.NeighborSummary) error {
	if db.Count != index.Count || db.LatestMonth != index.LatestMonth || math.Abs(db.TotalCash-index.TotalCash) > 0.01 {
		return fmt.Errorf("neighbor MySQL/index mismatch: mysql=%+v index=%+v", db, index)
	}
	if index.VersionedCount != index.Count {
		return fmt.Errorf("neighbor index has %d/%d documents on current rules", index.VersionedCount, index.Count)
	}
	return nil
}

func validateNeighborStatistics(index taipowerRepo.NeighborSummary, cityArea, unit *taipowerModel.NeighborStatisticsOutput, purpose *taipowerModel.NeighborPurposeStatisticsOutput) error {
	for name, rows := range map[string][]taipowerModel.NeighborStatistic{"cityarea": cityArea.Data, "unit": unit.Data} {
		var total float64
		for _, row := range rows {
			total += row.TotalCash
		}
		if math.Abs(total-index.TotalCash) > 0.01 {
			return fmt.Errorf("%s statistics total differs from index: %.6f vs %.6f", name, total, index.TotalCash)
		}
	}
	var count int64
	var total float64
	for _, row := range purpose.Data {
		count += row.Count
		total += row.TotalCash
	}
	if count != index.Count || math.Abs(total-index.TotalCash) > 0.01 {
		return fmt.Errorf("purpose statistics differs from index: count=%d/%d total=%.6f/%.6f", count, index.Count, total, index.TotalCash)
	}
	return nil
}

func formatNeighborYearMonth(value int) string {
	if value == 0 {
		return ""
	}
	return fmt.Sprintf("%04d-%02d", value/100, value%100)
}

func newStatisticsS3Client(ctx context.Context) (*s3.Client, error) {
	cfg := config.EnvConfig()
	credentialsProvider := credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, "")
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(cfg.S3Region), awsconfig.WithCredentialsProvider(credentialsProvider))
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}
	return s3.NewFromConfig(awsCfg), nil
}

func uploadNeighborJSON(ctx context.Context, client *s3.Client, key string, content []byte, cacheControl string) error {
	_, err := client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(config.EnvConfig().S3Bucket), Key: aws.String(key), Body: bytes.NewReader(content),
		ContentType: aws.String("application/json; charset=utf-8"), CacheControl: aws.String(cacheControl),
	})
	if err != nil {
		return fmt.Errorf("upload %s: %w", key, err)
	}
	return nil
}
