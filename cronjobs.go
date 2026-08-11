package main

import (
	"time"

	"faryne.dev/model/enum"
	avService "faryne.dev/service/av"
	erogeService "faryne.dev/service/eroge"
	"faryne.dev/service/log"
	"faryne.dev/service/nccc"
	storytellerService "faryne.dev/service/storyteller"
	"faryne.dev/service/taipower"
	"faryne.dev/service/twse"
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
	// 台電相關 job 手動執行
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
