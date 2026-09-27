package storyteller

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
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
	CommitAuditExport(row *storytellerModel.AuditExport, eventIDs []uint64, archivedAt time.Time) error
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

// RunAuditArchiveExport 每月月初把「已結束」月份裡還沒匯出的事件匯出到 S3：沒匯出過的月份整月匯出，
// 已匯出的月份只補匯還沒封存的晚到事件（例如 Stream 重試晚寫進 MySQL 的）。
// 會從 MySQL 最早的月份開始檢查，所以某個月失敗了，下次排程會自動重試。
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
	previous := make(map[string]*storytellerModel.AuditExport, len(exports))
	for index := range exports {
		if exports[index].Status == storytellerModel.AuditExportStatusExported {
			previous[exports[index].Month] = &exports[index]
		}
	}
	exported := make([]string, 0)
	current := auditMonthStart(now)
	for month := auditMonthStart(*earliest); month.Before(current); month = month.AddDate(0, 1, 0) {
		key := month.Format(auditArchiveMonthKey)
		base := previous[key]
		if base != nil && base.ArchivePurgedAt != nil {
			continue
		}
		committed, exportErr := exportAuditMonth(ctx, repo, store, prefix, month, base, retentionYears, now)
		if exportErr != nil {
			// 補匯失敗不能蓋掉既有的成功紀錄，只有首次匯出失敗才記成 failed；兩種都等下次排程重試。
			if base == nil {
				// error_message 欄位是 VARCHAR(255)，以字元截斷避免切壞中文。
				message := []rune(exportErr.Error())
				errorMessage := string(message[:min(len(message), 250)])
				if err := repo.SaveAuditExport(&storytellerModel.AuditExport{Month: key, Status: storytellerModel.AuditExportStatusFailed, ErrorMessage: &errorMessage}); err != nil {
					return exported, errors.Join(exportErr, err)
				}
			}
			return exported, exportErr
		}
		if committed {
			exported = append(exported, key)
		}
	}
	return exported, nil
}

// exportAuditMonth 把一個月份裡還沒封存的事件依時間順序寫成 JSONL.gz 檔（每檔最多 auditArchivePartRows 筆），
// 再以 CommitAuditExport 在同一個交易裡標記這些事件並更新匯出紀錄。
// part 編號接在既有檔案後面，補匯不會覆蓋已匯出的檔；提交失敗重跑時沿用同樣的編號，覆蓋這次沒提交成功的檔
// （Object Lock 會保留舊版本，但 Athena 只讀目前版本）。已匯出且沒有新事件時不做任何事，回傳 false。
func exportAuditMonth(ctx context.Context, repo auditArchiveExportRepository, store auditArchiveObjectStore, prefix string, month time.Time, base *storytellerModel.AuditExport, retentionYears int, now time.Time) (bool, error) {
	from, to := month, month.AddDate(0, 1, 0)
	retainUntil := to.AddDate(retentionYears, 0, 0)
	result := &storytellerModel.AuditExport{Month: month.Format(auditArchiveMonthKey), Status: storytellerModel.AuditExportStatusExported}
	if base != nil {
		result.RowCount = base.RowCount
		result.ObjectKeys = append(storytellerModel.StringList{}, base.ObjectKeys...)
		// 保存年數設定改短時，已鎖的舊檔仍以原本的 retain_until 為準，紀錄取較晚者。
		if base.RetainUntil != nil && base.RetainUntil.After(retainUntil) {
			retainUntil = *base.RetainUntil
		}
	}
	monthPrefix := auditArchiveMonthPrefix(prefix, month)
	partSums, eventIDs := make([]string, 0), make([]uint64, 0)
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
		key := fmt.Sprintf("%spart-%05d.jsonl.gz", monthPrefix, len(result.ObjectKeys))
		if err := store.PutArchiveObject(ctx, key, part.Bytes(), retainUntil); err != nil {
			return err
		}
		sum := sha256.Sum256(part.Bytes())
		result.ObjectKeys, partSums = append(result.ObjectKeys, key), append(partSums, hex.EncodeToString(sum[:]))
		part.Reset()
		gz, partRows = nil, 0
		return nil
	}
	var afterAt *time.Time
	var afterID uint64
	for {
		rows, err := repo.AuditEventsForExport(from, to, afterAt, afterID, auditArchiveExportBatch)
		if err != nil {
			return false, err
		}
		for _, event := range rows {
			if gz == nil {
				gz = gzip.NewWriter(&part)
			}
			line, err := json.Marshal(auditArchiveRecordFrom(event))
			if err != nil {
				return false, err
			}
			if _, err := gz.Write(append(line, '\n')); err != nil {
				return false, err
			}
			eventIDs = append(eventIDs, event.ID)
			if partRows++; partRows >= auditArchivePartRows {
				if err := flush(); err != nil {
					return false, err
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
		return false, err
	}
	if base != nil && len(eventIDs) == 0 {
		return false, nil
	}
	// checksum 是串鏈：補匯時把上一次的 checksum 放在最前面，再接這次新增檔案的 checksum。
	if base != nil && base.Checksum != nil {
		partSums = append([]string{*base.Checksum}, partSums...)
	}
	checksum := sha256.Sum256([]byte(strings.Join(partSums, "\n")))
	checksumHex := hex.EncodeToString(checksum[:])
	exportedAt := now
	result.RowCount += uint64(len(eventIDs))
	result.Checksum, result.RetainUntil, result.ExportedAt = &checksumHex, &retainUntil, &exportedAt
	if err := repo.CommitAuditExport(result, eventIDs, now); err != nil {
		return false, err
	}
	return true, nil
}
