package main

import (
	"context"
	"time"

	"faryne.dev/model/enum"
	avService "faryne.dev/service/av"
	erogeService "faryne.dev/service/eroge"
	"faryne.dev/service/log"
	"faryne.dev/service/nccc"
	ratesService "faryne.dev/service/rates"
	storytellerService "faryne.dev/service/storyteller"
	storytellerNotifyService "faryne.dev/service/storytellernotify"
	storytellerOAuthService "faryne.dev/service/storytelleroauth"
	"faryne.dev/service/taipower"
	"faryne.dev/service/twse"
	"faryne.dev/service/twstats"
	vtuberService "faryne.dev/service/vtuber"
)

type cronJobConfig struct {
	Name     string
	Schedule string
	Enabled  bool
	Handler  func()
}

// cronGroup 一個功能群：Enabled 為 false 時，底下所有 job 都不會進排程（手動用 -cmd 執行不受影響）。
type cronGroup struct {
	Enabled bool
	Jobs    []cronJobConfig
}

// cronJobs 依功能群分桶存放；新增 job 前直接看有沒有對應的 group key，不用翻整份平鋪清單。
var cronJobs = map[string]cronGroup{
	"eroge-youtube": {
		Enabled: true,
		Jobs: []cronJobConfig{
			{
				Name:     "eroge-youtube-add-brand",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					erogeService.RunAddBrand(
						commandParams.Value("brandName"),
						commandParams.Value("youtubeChannel"),
					)
				},
			},
			{
				Name:     "eroge-youtube-import-brands",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					erogeService.RunImportBrands(commandParams.Value("csvFile"))
				},
			},
			{
				Name:     "eroge-youtube-update-brand",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					erogeService.RunUpdateBrand(
						commandParams.Value("brandId"),
						commandParams.Value("youtubeURL"),
					)
				},
			},
			{
				Name:     "eroge-youtube-delete-brand",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					erogeService.RunDeleteBrand(commandParams.Value("brandId"))
				},
			},
			{
				Name:     "eroge-youtube-import-playlist-brands",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					erogeService.RunImportPlaylistBrands(commandParams.Value("playlist"))
				},
			},
			{
				Name:     "eroge-youtube-resync-brand-videos",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					erogeService.RunResyncBrandVideos(commandParams.Value("brandIds"))
				},
			},
			{
				Name:     "eroge-youtube-backfill-video-duration",
				Schedule: "",
				Enabled:  true,
				Handler:  erogeService.RunBackfillVideoDuration,
			},
			{
				Name:     "eroge-youtube-brands",
				Schedule: "15 2 * * 1",
				Enabled:  true,
				Handler:  erogeService.RunBrandSync,
			},
			{
				Name:     "eroge-youtube-videos",
				Schedule: "45 */8 * * *",
				Enabled:  true,
				Handler:  erogeService.RunVideoSync,
			},
		},
	},
	"etf": {
		Enabled: true,
		Jobs: []cronJobConfig{
			{
				Name:     "etf-code-share-twse",
				Schedule: "0 0 * * *",
				Enabled:  true,
				Handler: func() {
					_, _ = twse.UpdateETFCodeList()
					twse.UpdateETFShare(enum.StockMarketTWSE)
				},
			},
			{
				Name:     "etf-share-otc",
				Schedule: "0 1 * * *",
				Enabled:  true,
				Handler: func() {
					twse.UpdateETFShare(enum.StockMarketOTC)
				},
			},
			{
				Name:     "etf-ticker-daily",
				Schedule: "0 15 * * *",
				Enabled:  true,
				Handler: func() {
					d := time.Now().Format(time.DateOnly)
					twse.UpdateETFTicker("twse", d)
					twse.UpdateETFTicker("otc", d)
				},
			},
			{
				Name:     "etf-ex-info",
				Schedule: "7 16 * * 1-5",
				Enabled:  true,
				Handler: func() {
					twse.UpdateExPriceAndYieldRate()
					twse.UpdateFilledDays()
					twse.UpdateETFWinRate()
				},
			},
			{
				Name:     "etf-monthly-price",
				Schedule: "0 1 1 * *",
				Enabled:  true,
				Handler: func() {
					now := time.Now()
					lastMonth := now.AddDate(0, -1, 0)
					s := twse.NewETFMonthlyPriceService()
					_ = s.UpdateMonthlyPriceByMonth(lastMonth.Year(), int(lastMonth.Month()))
				},
			},
			{
				Name:     "etf-notify-ex",
				Schedule: "0 8 * * *",
				Enabled:  true,
				Handler: func() {
					_ = twse.NotifyUpcomingETFEx()
				},
			},
		},
	},
	"vtuber": {
		Enabled: true,
		Jobs: []cronJobConfig{
			{
				Name:     "vtuber-hololive-talents",
				Schedule: "30 2 * * 1",
				Enabled:  true,
				Handler:  vtuberService.RunSyncTalentChannels,
			},
			{
				// 偵測直播後接著同步 Google 行事曆
				Name:     "vtuber-lives-detect",
				Schedule: "*/5 * * * *",
				Enabled:  true,
				Handler:  vtuberService.RunDetectLives,
			},
			{
				// 頻道資訊與每日統計，順便改名行事曆、清掉 Firebase 過期事件記錄
				Name:     "vtuber-stats-daily",
				Schedule: "10 3 * * *",
				Enabled:  true,
				Handler:  vtuberService.RunDailyStats,
			},
			{
				// 一次性：從舊 Firebase 匯入 Apps Script 時代建好的行事曆（需要 VTUBER_LEGACY_FIREBASE_SECRET）
				Name:     "vtuber-import-calendars",
				Schedule: "",
				Enabled:  true,
				Handler:  vtuberService.RunImportCalendars,
			},
		},
	},
	"av": {
		Enabled: true,
		Jobs: []cronJobConfig{
			{
				Name:     "av-sync-xcity",
				Schedule: "37 1 * * 3",
				Enabled:  true,
				Handler: func() {
					avService.SyncXCityActressesCron()
				},
			},
			{
				// 前一天配信作品寫入 MySQL dmm＋ES dmmvideos；回補用 -dayFrom／-dayTo（含）
				Name:     "av-dmm-video-sync",
				Schedule: "50 3 * * *",
				Enabled:  true,
				Handler: func() {
					avService.RunDMMVideoSync(commandParams.Value("dayFrom"), commandParams.Value("dayTo"))
				},
			},
			{
				// 先同步當天作品，同步完再把當天上架清單前 10 筆發到 Telegram；可用 -dayFrom 指定日期
				Name:     "av-dmm-video-notify",
				Schedule: "0 10 * * *",
				Enabled:  true,
				Handler: func() {
					avService.RunDMMVideoSyncAndNotify(commandParams.Value("dayFrom"))
				},
			},
			{
				// 每週產生女優主題 JSON 上傳 S3（排在週三 xcity 同步之後）；非 production 只寫本機 tmp/actress-topics/
				Name:     "av-actress-topics",
				Schedule: "30 4 * * 4",
				Enabled:  true,
				Handler:  avService.RunActressTopicsCron,
			},
		},
	},
	"nccc": {
		Enabled: true,
		Jobs: []cronJobConfig{
			{
				Name:     "nccc-download",
				Schedule: "12 3 15 * *",
				Enabled:  true,
				Handler: func() {
					nccc.RunDownload(commandParams.Value("ncccKey"))
				},
			},
			{
				Name:     "nccc-clear-indexes",
				Schedule: "",
				Enabled:  true,
				Handler:  nccc.RunClearIndexes,
			},
		},
	},
	"storyteller": {
		Enabled: true,
		Jobs: []cronJobConfig{
			{
				// 每月 1 日把上個月（以及之前失敗的月份）的稽核事件匯出到 S3。
				Name:     "storyteller-audit-archive-export-monthly",
				Schedule: "10 3 1 * *",
				Enabled:  true,
				Handler:  storytellerService.RunAuditArchiveExport,
			},
			{
				// 每天檢查保存期限：MySQL 只刪已匯出且超過近期月數的月份，S3 只刪鎖定期已過的月份。
				Name:     "storyteller-audit-archive-maintenance-daily",
				Schedule: "40 3 * * *",
				Enabled:  true,
				Handler:  storytellerService.RunAuditArchiveMaintenance,
			},
			{
				// 找出新公開的話，依專案聚合後通知追蹤者與收藏者（最多晚 5 分鐘）
				Name:     "storyteller-notification-publish-scan",
				Schedule: "*/5 * * * *",
				Enabled:  true,
				Handler:  storytellerService.RunNotificationPublishScan,
			},
			{
				// 站內通知保留 180 天，鎖定的不清
				Name:     "storyteller-notification-purge-daily",
				Schedule: "25 4 * * *",
				Enabled:  true,
				Handler:  storytellerNotifyService.RunPurgeExpiredNotifications,
			},
			{
				Name:     "storyteller-cleanup-assistant-memory-drafts",
				Schedule: "35 4 * * *",
				Enabled:  true,
				Handler:  storytellerService.RunCleanupAssistantMemoryDrafts,
			},
			{
				// 停權滿 bannedAccountPurgeAfter（6 個月）的帳號，清除其下仍未刪除的內容
				Name:     "storyteller-purge-banned-accounts",
				Schedule: "40 4 * * *",
				Enabled:  true,
				Handler:  storytellerService.RunPurgeBannedAccounts,
			},
			{
				// OAuth DCR 是公開端點，每天清掉註冊超過 7 天仍沒完成授權的 client
				Name:     "storyteller-cleanup-oauth-clients",
				Schedule: "50 4 * * *",
				Enabled:  true,
				Handler:  storytellerOAuthService.RunCleanupUnusedClients,
			},
			{
				Name:     "storyteller-sync-agent-models-weekly",
				Schedule: "20 4 * * 1",
				Enabled:  true,
				Handler:  storytellerService.RunSyncStorytellerAgentModels,
			},
			{
				Name:     "storyteller-rotate-agent-api-keys",
				Schedule: "",
				Enabled:  true,
				Handler:  storytellerService.RunRotateStorytellerAgentAPIKeys,
			},
			{
				Name:     "storyteller-search-sync",
				Schedule: "",
				Enabled:  true,
				Handler:  storytellerService.RunSyncStorytellerSearchIndex,
			},
			{
				Name:     "storyteller-search-create-index",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					storytellerService.RunCreateStorytellerSearchIndex(commandParams.Value("searchIndexName"))
				},
			},
			{
				Name:     "storyteller-backfill-image-story-assets",
				Schedule: "",
				Enabled:  true,
				Handler:  storytellerService.RunBackfillImageStoryAssets,
			},
		},
	},
	// 各銀行現鈔牌告匯率；手動執行可加 -bank <service_name> 只跑單家
	"rates": {
		Enabled: true,
		Jobs: []cronJobConfig{
			{
				Name:     "rates-fetch",
				Schedule: "15 9 * * 1-5",
				Enabled:  true,
				Handler: func() {
					// 單家失敗已在 service 內記 log，這裡只留總結
					if err := ratesService.Run(context.Background(), commandParams.Value("bank")); err != nil {
						log.Logger().Warn("Rates fetch finished with errors: " + err.Error())
					}
				},
			},
		},
	},
	// 台電相關 job 手動執行
	"tw-stats": {
		Enabled: true,
		Jobs: []cronJobConfig{
			{
				// 每小時檢查一次：尚未載入（啟動時抓失敗）或超過 24 小時才真的重抓，兼做每日刷新與失敗重試
				Name:     "tw-stats-refresh",
				Schedule: "5 * * * *",
				Enabled:  true,
				Handler: func() {
					if err := twstats.Default.EnsureFresh(context.Background()); err != nil {
						log.Logger().Error("tw-stats refresh failed: " + err.Error())
					}
				},
			},
		},
	},
	"taipower": {
		Enabled: true,
		Jobs: []cronJobConfig{
			{
				Name:     "taipower-neighbor-backfill",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					if err := taipower.NewNeighborService().Backfill(); err != nil {
						log.Logger().Error("Taipower neighbor backfill failed: " + err.Error())
					}
				},
			},
			{
				Name:     "taipower-neighbor-monthly",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					if _, err := taipower.NewNeighborService().CrawlPreviousMonth(); err != nil {
						log.Logger().Error("Taipower neighbor monthly crawl failed: " + err.Error())
					}
				},
			},
			{
				Name:     "taipower-neighbor-range",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					if err := taipower.NewNeighborService().CrawlRange(
						commandParams.Value("yearMonthFrom"),
						commandParams.Value("yearMonthTo"),
					); err != nil {
						log.Logger().Error("Taipower neighbor range crawl failed: " + err.Error())
					}
				},
			},
			{
				Name:     "taipower-neighbor-sync-es",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					if err := taipower.NewNeighborService().SyncAllToElasticsearch(); err != nil {
						log.Logger().Error("Taipower neighbor Elasticsearch sync failed: " + err.Error())
					}
				},
			},
			{
				Name:     "taipower-neighbor-generate-statistics",
				Schedule: "",
				Enabled:  true,
				Handler: func() {
					if err := taipower.GenerateNeighborStatisticsFiles(); err != nil {
						log.Logger().Error("Taipower neighbor statistics generation failed: " + err.Error())
					}
				},
			},
		},
	},
}

// executeCommand 依 name 找 job 手動執行；不吃 group／job 的 Enabled 開關，
// 因為手動 -cmd 是明確的人為動作，不應被自動排程開關擋下來。
func executeCommand(name string) {
	log.Logger().Info("Executing command: " + name)
	found := false
	for _, group := range cronJobs {
		for _, job := range group.Jobs {
			if job.Name == name {
				job.Handler()
				found = true
				break
			}
		}
		if found {
			break
		}
	}
	if !found {
		log.Logger().Error("Unknown command: " + name)
	}
	log.Logger().Info("Command execution finished")
}

func runCronJob(name string) {
	log.Logger().Info("CronJob triggered: " + name)
	executeCommand(name)
}
