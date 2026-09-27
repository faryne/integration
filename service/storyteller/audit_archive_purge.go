package storyteller

import (
	"context"
	"errors"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

const auditArchiveDeleteBatch = 5000

type auditArchivePurgeRepository interface {
	AuditExports() ([]storytellerModel.AuditExport, error)
	SaveAuditExport(row *storytellerModel.AuditExport) error
	DeleteAuditEventsBetween(from, to time.Time, limit int) (int64, error)
}

// RunAuditArchiveMaintenance 每天檢查一次保存期限：MySQL 只刪「已確認匯出」且超過近期月數的月份；
// S3 只刪「鎖定期已過」而且「月底 + 目前設定年數」也已過的月份，兩段刪除各記一筆系統稽核事件。
func RunAuditArchiveMaintenance() {
	if !auditArchiveEnabled() {
		return
	}
	now := time.Now()
	repo := NewService().repo
	mysqlStartedAt := time.Now()
	mysqlMonths, mysqlErr := purgeArchivedMySQLAuditMonths(repo, now, auditHotMonths())
	if mysqlErr != nil {
		log.Logger().Error("Storyteller audit MySQL purge failed", zap.Strings("purged", mysqlMonths), zap.Error(mysqlErr))
	}
	if len(mysqlMonths) > 0 || mysqlErr != nil {
		emitStorytellerCronAudit("system.audit.mysql_purge", mysqlStartedAt, storytellerModel.AuditSummary{"months": mysqlMonths, "count": len(mysqlMonths)}, mysqlErr)
	}

	archiveStartedAt := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	store, err := newS3AuditArchiveStore(ctx)
	var archiveMonths []string
	if err == nil {
		archiveMonths, err = purgeExpiredArchiveMonths(ctx, repo, store, auditArchivePrefix(), auditArchiveRetentionYears(), now)
	}
	if err != nil {
		log.Logger().Error("Storyteller audit archive purge failed", zap.Strings("purged", archiveMonths), zap.Error(err))
	}
	if len(archiveMonths) > 0 || err != nil {
		emitStorytellerCronAudit("system.audit.archive_purge", archiveStartedAt, storytellerModel.AuditSummary{"months": archiveMonths, "count": len(archiveMonths)}, err)
	}
}

// purgeArchivedMySQLAuditMonths 刪除「月底已早於近期保存起點」且「匯出成功」的月份；
// 沒匯出成功的月份永遠不刪，確保 MySQL 與 S3 之間不會出現空窗。
func purgeArchivedMySQLAuditMonths(repo auditArchivePurgeRepository, now time.Time, hotMonths int) ([]string, error) {
	exports, err := repo.AuditExports()
	if err != nil {
		return nil, err
	}
	hotFrom := now.AddDate(0, -hotMonths, 0)
	purged := make([]string, 0)
	for _, row := range exports {
		if row.Status != storytellerModel.AuditExportStatusExported || row.MySQLPurgedAt != nil {
			continue
		}
		month, err := parseAuditMonth(row.Month)
		if err != nil {
			return purged, err
		}
		monthEnd := month.AddDate(0, 1, 0)
		if monthEnd.After(hotFrom) {
			continue
		}
		for {
			deleted, err := repo.DeleteAuditEventsBetween(month, monthEnd, auditArchiveDeleteBatch)
			if err != nil {
				return purged, err
			}
			if deleted < auditArchiveDeleteBatch {
				break
			}
		}
		purgedAt := now
		row.MySQLPurgedAt = &purgedAt
		if err := repo.SaveAuditExport(&row); err != nil {
			return purged, err
		}
		purged = append(purged, row.Month)
	}
	return purged, nil
}

// purgeExpiredArchiveMonths 只刪鎖定期已過的月份：同時看匯出時寫下的 retain_until 與
// 「月底 + 目前設定的保存年數」，取較晚者。延長保存年數時不會誤刪；縮短保存年數也不會提前刪
// （S3 本身還鎖著，刪也會失敗）。刪完保留匯出紀錄並寫入 archive_purged_at 作為證明。
func purgeExpiredArchiveMonths(ctx context.Context, repo auditArchivePurgeRepository, store auditArchiveObjectStore, prefix string, retentionYears int, now time.Time) ([]string, error) {
	exports, err := repo.AuditExports()
	if err != nil {
		return nil, err
	}
	purged := make([]string, 0)
	var purgeErr error
	for _, row := range exports {
		if row.Status != storytellerModel.AuditExportStatusExported || row.ArchivePurgedAt != nil {
			continue
		}
		month, err := parseAuditMonth(row.Month)
		if err != nil {
			return purged, err
		}
		expiresAt := month.AddDate(0, 1, 0).AddDate(retentionYears, 0, 0)
		if row.RetainUntil != nil && row.RetainUntil.After(expiresAt) {
			expiresAt = *row.RetainUntil
		}
		if expiresAt.After(now) {
			continue
		}
		if _, err := store.DeleteArchivePrefix(ctx, auditArchiveMonthPrefix(prefix, month)); err != nil {
			// 某個月刪不掉（例如鎖定期被手動延長）時記下錯誤並繼續處理其他月份。
			purgeErr = errors.Join(purgeErr, err)
			continue
		}
		purgedAt := now
		row.ArchivePurgedAt = &purgedAt
		if err := repo.SaveAuditExport(&row); err != nil {
			return purged, err
		}
		purged = append(purged, row.Month)
	}
	return purged, purgeErr
}
