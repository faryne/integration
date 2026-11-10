package taipower

import (
	"context"
	"fmt"
	"time"

	taipowerRepo "faryne.dev/repository/taipower"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// RunNeighborRecentSync 每週重抓最近三個完整月份；成功後才發布新版統計。
func RunNeighborRecentSync() error {
	return taipowerRepo.NewNeighborRepository().WithSyncLock(func() error {
		location, err := time.LoadLocation("Asia/Taipei")
		if err != nil {
			return err
		}
		now := time.Now().In(location)
		last := time.Date(now.Year(), now.Month()-1, 1, 0, 0, 0, 0, location)
		first := last.AddDate(0, -2, 0)
		if err := NewNeighborService().crawlMonths(first, last); err != nil {
			return fmt.Errorf("crawl recent months: %w", err)
		}
		if err := logNeighborRevisionCandidates(first, last); err != nil {
			return err
		}
		return GenerateNeighborStatisticsFiles()
	})
}

// RunNeighborPreviousMonthSync 保留舊手動指令並一併發布統計。
func RunNeighborPreviousMonthSync() error {
	return taipowerRepo.NewNeighborRepository().WithSyncLock(func() error {
		if _, err := NewNeighborService().CrawlPreviousMonth(); err != nil {
			return err
		}
		return GenerateNeighborStatisticsFiles()
	})
}

// RunNeighborRangeSync 將手動指定月份的抓取與統計發布視為一次作業。
func RunNeighborRangeSync(from, to string) error {
	return taipowerRepo.NewNeighborRepository().WithSyncLock(func() error {
		if err := NewNeighborService().CrawlRange(from, to); err != nil {
			return err
		}
		first, _ := parseCrawlMonth(from)
		last := time.Now().AddDate(0, -1, 0)
		if to != "" {
			last, _ = parseCrawlMonth(to)
		}
		if err := logNeighborRevisionCandidates(first, last); err != nil {
			return err
		}
		return GenerateNeighborStatisticsFiles()
	})
}

func logNeighborRevisionCandidates(from, to time.Time) error {
	rows, err := taipowerRepo.NewNeighborRepository().RevisionCandidates(from.Year()*100+int(from.Month()), to.Year()*100+int(to.Month()))
	if err != nil {
		return err
	}
	for _, row := range rows {
		log.Logger().Warn("Taipower neighbor possible revision", zap.Int("year", row.ObjYear), zap.Int("month", row.ObjMonth), zap.Int("source_row", row.ObjMonthID), zap.Int64("stored_rows", row.Count))
	}
	return nil
}

// RunNeighborBackfillSync 回補歷史月份後一併發布新統計。
func RunNeighborBackfillSync() error {
	return taipowerRepo.NewNeighborRepository().WithSyncLock(func() error {
		if err := NewNeighborService().Backfill(); err != nil {
			return err
		}
		return GenerateNeighborStatisticsFiles()
	})
}

// RunNeighborFullIndexSync 在分類或名稱規則升版後重建索引與統計。
func RunNeighborFullIndexSync() error {
	return taipowerRepo.NewNeighborRepository().WithSyncLock(func() error {
		indexName, err := createNeighborRebuildIndex(context.Background())
		if err != nil {
			return err
		}
		log.Logger().Info("Taipower neighbor rebuild index created", zap.String("index", indexName))
		if err := NewNeighborService().SyncAllToElasticsearch(indexName); err != nil {
			return err
		}
		if err := validateNeighborRebuildIndex(context.Background(), indexName); err != nil {
			return err
		}
		if err := promoteNeighborRebuildIndex(context.Background(), indexName); err != nil {
			return err
		}
		log.Logger().Info("Taipower neighbor index promoted", zap.String("index", indexName))
		return GenerateNeighborStatisticsFiles()
	})
}

// RunNeighborStatisticsPublish 提供不重新抓來源的安全手動重發佈。
func RunNeighborStatisticsPublish() error {
	return taipowerRepo.NewNeighborRepository().WithSyncLock(GenerateNeighborStatisticsFiles)
}
