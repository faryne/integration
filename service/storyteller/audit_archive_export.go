package storyteller

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

const (
	auditArchiveExportBatch = 5000
	auditArchivePartRows    = 100000
	// 固定寬度的 UTC 時間，讓 Athena 以字串排序時等同時間排序。
	auditArchiveTimeLayout = "2006-01-02T15:04:05.000000Z"
	auditArchiveMonthKey   = "2006-01"
)

type auditArchiveExportRepository interface {
	AuditEarliestEventTime() (*time.Time, error)
	AuditEventsForExport(from, to time.Time, afterAt *time.Time, afterID uint64, limit int) ([]storytellerModel.AuditEvent, error)
	AuditEventCountBetween(from, to time.Time) (int64, error)
	AuditExports() ([]storytellerModel.AuditExport, error)
	SaveAuditExport(row *storytellerModel.AuditExport) error
}

// auditArchiveRecord 是 S3 上 JSONL 的一行，欄位與 Athena 資料表一一對應；
// summary 存成 JSON 字串，讓 Athena schema 不必跟著 summary 內容變動。
type auditArchiveRecord struct {
	EventID        string  `json:"event_id"`
	OccurredAt     string  `json:"occurred_at"`
	ActorType      string  `json:"actor_type"`
	ActorUserID    *uint64 `json:"actor_user_id"`
	Source         string  `json:"source"`
	AuthMethod     string  `json:"auth_method"`
	CredentialRef  *string `json:"credential_ref"`
	IP             *string `json:"ip"`
	UserAgent      *string `json:"user_agent"`
	RequestID      *string `json:"request_id"`
	ProjectID      *uint64 `json:"project_id"`
	Action         string  `json:"action"`
	TargetType     *string `json:"target_type"`
	TargetPublicID *string `json:"target_public_id"`
	Outcome        string  `json:"outcome"`
	Summary        string  `json:"summary,omitempty"`
}

func auditArchiveRecordFrom(event storytellerModel.AuditEvent) auditArchiveRecord {
	record := auditArchiveRecord{
		EventID: event.EventID, OccurredAt: event.OccurredAt.UTC().Format(auditArchiveTimeLayout),
		ActorType: string(event.ActorType), ActorUserID: event.ActorUserID, Source: string(event.Source),
		AuthMethod: string(event.AuthMethod), CredentialRef: event.CredentialRef, IP: event.IP, UserAgent: event.UserAgent,
		RequestID: event.RequestID, ProjectID: event.ProjectID, Action: event.Action, TargetType: event.TargetType,
		TargetPublicID: event.TargetPublicID, Outcome: string(event.Outcome),
	}
	if len(event.Summary) > 0 {
		if raw, err := json.Marshal(event.Summary); err == nil {
			record.Summary = string(raw)
		}
	}
	return record
}

func auditMonthStart(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

func parseAuditMonth(month string) (time.Time, error) {
	return time.ParseInLocation(auditArchiveMonthKey, month, time.UTC)
}

// auditArchiveMonthPrefix 與 Athena partition projection 的 storage.location.template 對應。
func auditArchiveMonthPrefix(prefix string, month time.Time) string {
	return fmt.Sprintf("%s/year=%04d/month=%02d/", strings.TrimSuffix(prefix, "/"), month.Year(), int(month.Month()))
}

// RunAuditArchiveExport 每月月初把「已結束、還沒匯出」的月份匯出到 S3；
// 會從 MySQL 最早的月份開始補，所以某個月失敗了，下次排程會自動重試。
func RunAuditArchiveExport() {
	if !auditArchiveEnabled() {
		log.Logger().Info("Storyteller audit archive export skipped: archive bucket is not configured")
		return
	}
	startedAt := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	store, err := newS3AuditArchiveStore(ctx)
	var months []string
	if err == nil {
		months, err = exportPendingAuditMonths(ctx, NewService().repo, store, auditArchivePrefix(), auditArchiveRetentionYears(), startedAt)
	}
	if err != nil {
		log.Logger().Error("Storyteller audit archive export failed", zap.Strings("exported", months), zap.Error(err))
	}
	emitStorytellerCronAudit("system.audit.export", startedAt, storytellerModel.AuditSummary{"months": months, "count": len(months)}, err)
}

func exportPendingAuditMonths(ctx context.Context, repo auditArchiveExportRepository, store auditArchiveObjectStore, prefix string, retentionYears int, now time.Time) ([]string, error) {
	earliest, err := repo.AuditEarliestEventTime()
	if err != nil || earliest == nil {
		return nil, err
	}
	exports, err := repo.AuditExports()
	if err != nil {
		return nil, err
	}
	done := make(map[string]bool, len(exports))
	for _, row := range exports {
		done[row.Month] = row.Status == storytellerModel.AuditExportStatusExported
	}
	exported := make([]string, 0)
	current := auditMonthStart(now)
	for month := auditMonthStart(*earliest); month.Before(current); month = month.AddDate(0, 1, 0) {
		key := month.Format(auditArchiveMonthKey)
		if done[key] {
			continue
		}
		row, exportErr := exportAuditMonth(ctx, repo, store, prefix, month, retentionYears, now)
		if exportErr != nil {
			// error_message 欄位是 VARCHAR(255)，以字元截斷避免切壞中文。
			message := []rune(exportErr.Error())
			message = message[:min(len(message), 250)]
			errorMessage := string(message)
			row = &storytellerModel.AuditExport{Month: key, Status: storytellerModel.AuditExportStatusFailed, ErrorMessage: &errorMessage}
		}
		if err := repo.SaveAuditExport(row); err != nil {
			return exported, err
		}
		if exportErr != nil {
			return exported, exportErr
		}
		exported = append(exported, key)
	}
	return exported, nil
}

// exportAuditMonth 把一個月份的事件依時間順序寫成多個 JSONL.gz 檔（每檔最多 auditArchivePartRows 筆），
// 檔名固定，重跑會覆蓋同名檔（Object Lock 會保留舊版本）；最後比對筆數，對不上就算失敗、不標成已匯出。
func exportAuditMonth(ctx context.Context, repo auditArchiveExportRepository, store auditArchiveObjectStore, prefix string, month time.Time, retentionYears int, now time.Time) (*storytellerModel.AuditExport, error) {
	from, to := month, month.AddDate(0, 1, 0)
	retainUntil := to.AddDate(retentionYears, 0, 0)
	monthPrefix := auditArchiveMonthPrefix(prefix, month)
	keys, partSums := make([]string, 0), make([]string, 0)
	var total uint64
	var part bytes.Buffer
	var gz *gzip.Writer
	partRows := 0
	flush := func() error {
		if gz == nil {
			return nil
		}
		if err := gz.Close(); err != nil {
			return err
		}
		key := fmt.Sprintf("%spart-%05d.jsonl.gz", monthPrefix, len(keys))
		if err := store.PutArchiveObject(ctx, key, part.Bytes(), retainUntil); err != nil {
			return err
		}
		sum := sha256.Sum256(part.Bytes())
		keys, partSums = append(keys, key), append(partSums, hex.EncodeToString(sum[:]))
		part.Reset()
		gz, partRows = nil, 0
		return nil
	}
	var afterAt *time.Time
	var afterID uint64
	for {
		rows, err := repo.AuditEventsForExport(from, to, afterAt, afterID, auditArchiveExportBatch)
		if err != nil {
			return nil, err
		}
		for _, event := range rows {
			if gz == nil {
				gz = gzip.NewWriter(&part)
			}
			line, err := json.Marshal(auditArchiveRecordFrom(event))
			if err != nil {
				return nil, err
			}
			if _, err := gz.Write(append(line, '\n')); err != nil {
				return nil, err
			}
			total++
			if partRows++; partRows >= auditArchivePartRows {
				if err := flush(); err != nil {
					return nil, err
				}
			}
		}
		if len(rows) < auditArchiveExportBatch {
			break
		}
		last := rows[len(rows)-1]
		afterAt, afterID = &last.OccurredAt, last.ID
	}
	if err := flush(); err != nil {
		return nil, err
	}
	count, err := repo.AuditEventCountBetween(from, to)
	if err != nil {
		return nil, err
	}
	if uint64(count) != total {
		return nil, fmt.Errorf("audit export row count mismatch for %s: exported %d, mysql %d", month.Format(auditArchiveMonthKey), total, count)
	}
	checksum := sha256.Sum256([]byte(strings.Join(partSums, "\n")))
	checksumHex := hex.EncodeToString(checksum[:])
	exportedAt := now
	return &storytellerModel.AuditExport{
		Month: month.Format(auditArchiveMonthKey), Status: storytellerModel.AuditExportStatusExported, RowCount: total,
		ObjectKeys: keys, Checksum: &checksumHex, RetainUntil: &retainUntil, ExportedAt: &exportedAt,
	}, nil
}
