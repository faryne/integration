package storyteller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"faryne.dev/config"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/athena"
	athenaTypes "github.com/aws/aws-sdk-go-v2/service/athena/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3Types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

var ErrAuditArchiveUnavailable = errors.New("稽核封存尚未設定，暫時無法使用封存查詢")

// Athena 的資料庫／資料表名稱會直接拼進 SQL（識別字不能參數化），只允許英數與底線。
var auditAthenaIdentifierPattern = regexp.MustCompile(`^[A-Za-z0-9_]+$`)

// auditArchiveObjectStore 是封存檔案的儲存端；正式環境是開了 Object Lock 的 S3 bucket。
type auditArchiveObjectStore interface {
	PutArchiveObject(ctx context.Context, key string, body []byte, retainUntil time.Time) error
	// DeleteArchivePrefix 刪除某個 prefix 底下的所有版本與 delete marker，確保資料真的從 S3 消失。
	DeleteArchivePrefix(ctx context.Context, prefix string) (int, error)
}

// auditArchiveQueryStatus 是一次輪詢拿到的 Athena 查詢狀態；CompletedAt 是 Athena 端的實際完成時間，
// 結果 bucket 的保留期從這個時間起算。
type auditArchiveQueryStatus struct {
	State        string
	ScannedBytes *uint64
	CompletedAt  *time.Time
}

// auditArchiveQueryEngine 是封存查詢引擎；正式環境是 Athena。
type auditArchiveQueryEngine interface {
	StartQuery(ctx context.Context, sql string, params []string) (string, error)
	QueryStatus(ctx context.Context, executionID string) (auditArchiveQueryStatus, error)
	QueryResults(ctx context.Context, executionID, nextToken string, maxResults int32) ([][]string, string, error)
}

func auditArchiveEnabled() bool { return config.EnvConfig().AuditArchiveBucket != "" }

func auditArchiveQueryEnabled() bool {
	cfg := config.EnvConfig()
	return auditArchiveEnabled() && cfg.AuditAthenaWorkgroup != "" &&
		auditAthenaIdentifierPattern.MatchString(cfg.AuditAthenaDatabase) &&
		auditAthenaIdentifierPattern.MatchString(cfg.AuditAthenaTable)
}

func auditArchiveRetentionYears() int {
	if years := config.EnvConfig().AuditArchiveRetentionYears; years > 0 {
		return years
	}
	return 7
}

func auditArchivePrefix() string {
	if prefix := config.EnvConfig().AuditArchivePrefix; prefix != "" {
		return prefix
	}
	return "audit"
}

// auditAWSConfig 優先使用稽核專用的 access key；沒設就走預設憑證鏈（EC2 instance role 等）。
// 這組權限不應該包含 s3:BypassGovernanceRetention，讓鎖定期內的封存檔連 backend 都刪不掉。
func auditAWSConfig(ctx context.Context) (aws.Config, error) {
	cfg := config.EnvConfig()
	region := cfg.AuditArchiveRegion
	if region == "" {
		region = cfg.S3Region
	}
	options := []func(*awsconfig.LoadOptions) error{awsconfig.WithRegion(region)}
	if cfg.AuditAWSAccessKey != "" && cfg.AuditAWSSecretKey != "" {
		options = append(options, awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AuditAWSAccessKey, cfg.AuditAWSSecretKey, "")))
	}
	return awsconfig.LoadDefaultConfig(ctx, options...)
}

type s3AuditArchiveStore struct {
	client *s3.Client
	bucket string
}

func newS3AuditArchiveStore(ctx context.Context) (auditArchiveObjectStore, error) {
	if !auditArchiveEnabled() {
		return nil, ErrAuditArchiveUnavailable
	}
	cfg, err := auditAWSConfig(ctx)
	if err != nil {
		return nil, err
	}
	return &s3AuditArchiveStore{client: s3.NewFromConfig(cfg), bucket: config.EnvConfig().AuditArchiveBucket}, nil
}

// PutArchiveObject 每個檔案都帶 per-object retention（governance mode），並附 SHA-256 checksum；
// Object Lock 的上傳本來就要求帶 checksum。
func (s *s3AuditArchiveStore) PutArchiveObject(ctx context.Context, key string, body []byte, retainUntil time.Time) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:                    aws.String(s.bucket),
		Key:                       aws.String(key),
		Body:                      bytes.NewReader(body),
		ContentType:               aws.String("application/gzip"),
		ChecksumAlgorithm:         s3Types.ChecksumAlgorithmSha256,
		ObjectLockMode:            s3Types.ObjectLockModeGovernance,
		ObjectLockRetainUntilDate: aws.Time(retainUntil),
	})
	return err
}

func (s *s3AuditArchiveStore) DeleteArchivePrefix(ctx context.Context, prefix string) (int, error) {
	deleted := 0
	paginator := s3.NewListObjectVersionsPaginator(s.client, &s3.ListObjectVersionsInput{Bucket: aws.String(s.bucket), Prefix: aws.String(prefix)})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return deleted, err
		}
		objects := make([]s3Types.ObjectIdentifier, 0, len(page.Versions)+len(page.DeleteMarkers))
		for _, version := range page.Versions {
			objects = append(objects, s3Types.ObjectIdentifier{Key: version.Key, VersionId: version.VersionId})
		}
		for _, marker := range page.DeleteMarkers {
			objects = append(objects, s3Types.ObjectIdentifier{Key: marker.Key, VersionId: marker.VersionId})
		}
		if len(objects) == 0 {
			continue
		}
		output, err := s.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket:            aws.String(s.bucket),
			Delete:            &s3Types.Delete{Objects: objects, Quiet: aws.Bool(true)},
			ChecksumAlgorithm: s3Types.ChecksumAlgorithmSha256,
		})
		if err != nil {
			return deleted, err
		}
		if len(output.Errors) > 0 {
			first := output.Errors[0]
			return deleted, fmt.Errorf("delete archive object %s failed: %s", aws.ToString(first.Key), aws.ToString(first.Code))
		}
		deleted += len(objects)
	}
	return deleted, nil
}

type athenaAuditQueryEngine struct {
	client    *athena.Client
	workgroup string
	database  string
}

func newAthenaAuditQueryEngine(ctx context.Context) (auditArchiveQueryEngine, error) {
	if !auditArchiveQueryEnabled() {
		return nil, ErrAuditArchiveUnavailable
	}
	cfg, err := auditAWSConfig(ctx)
	if err != nil {
		return nil, err
	}
	env := config.EnvConfig()
	return &athenaAuditQueryEngine{client: athena.NewFromConfig(cfg), workgroup: env.AuditAthenaWorkgroup, database: env.AuditAthenaDatabase}, nil
}

// StartQuery 用 ExecutionParameters 帶入所有使用者可影響的值，不把它們拼進 SQL 字串。
// 查詢結果的輸出位置與單次掃描上限由 workgroup 設定決定。
func (e *athenaAuditQueryEngine) StartQuery(ctx context.Context, sql string, params []string) (string, error) {
	output, err := e.client.StartQueryExecution(ctx, &athena.StartQueryExecutionInput{
		QueryString:           aws.String(sql),
		ExecutionParameters:   params,
		WorkGroup:             aws.String(e.workgroup),
		QueryExecutionContext: &athenaTypes.QueryExecutionContext{Database: aws.String(e.database)},
	})
	if err != nil {
		return "", err
	}
	return aws.ToString(output.QueryExecutionId), nil
}

func (e *athenaAuditQueryEngine) QueryStatus(ctx context.Context, executionID string) (auditArchiveQueryStatus, error) {
	output, err := e.client.GetQueryExecution(ctx, &athena.GetQueryExecutionInput{QueryExecutionId: aws.String(executionID)})
	if err != nil {
		return auditArchiveQueryStatus{}, err
	}
	var result auditArchiveQueryStatus
	if stats := output.QueryExecution.Statistics; stats != nil && stats.DataScannedInBytes != nil && *stats.DataScannedInBytes >= 0 {
		value := uint64(*stats.DataScannedInBytes)
		result.ScannedBytes = &value
	}
	if status := output.QueryExecution.Status; status != nil {
		result.State, result.CompletedAt = string(status.State), status.CompletionDateTime
	}
	return result, nil
}

func (e *athenaAuditQueryEngine) QueryResults(ctx context.Context, executionID, nextToken string, maxResults int32) ([][]string, string, error) {
	input := &athena.GetQueryResultsInput{QueryExecutionId: aws.String(executionID), MaxResults: aws.Int32(maxResults)}
	if nextToken != "" {
		input.NextToken = aws.String(nextToken)
	}
	output, err := e.client.GetQueryResults(ctx, input)
	if err != nil {
		return nil, "", err
	}
	rows := make([][]string, 0, len(output.ResultSet.Rows))
	for _, row := range output.ResultSet.Rows {
		values := make([]string, len(row.Data))
		for index, datum := range row.Data {
			values[index] = aws.ToString(datum.VarCharValue)
		}
		rows = append(rows, values)
	}
	return rows, aws.ToString(output.NextToken), nil
}
