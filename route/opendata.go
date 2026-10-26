package route

import (
	"faryne.dev/controller/opendata"
	"faryne.dev/middleware/authsession"
	authService "faryne.dev/service/auth"
	"github.com/gofiber/fiber/v3"
)

func OpenData(app *fiber.App) {
	taipowerGroup := app.Group("/taipower/neighbor")
	taipowerGroup.Get("/cityarea/:cityarea/:year?/:month?", opendata.TaipowerNeighborByCityArea)
	taipowerGroup.Get("/unit/:unit/:year?/:month?", opendata.TaipowerNeighborByUnit)
	taipowerGroup.Get("/:year?/:month?", opendata.TaipowerNeighbor)

	g := app.Group("/opendata")

	g1 := g.Group("/rates")
	g1.Get("", opendata.Rate)
	g1.Get("/banks", opendata.Banks)
	g1.Get("/currencies", opendata.Currencies)

	g2 := g.Group("/fd")
	g2.Get("", opendata.FetchNtpcFDEvents)
	g2.Get("/units", opendata.FetchNtpcFDUnits)
	g2.Get("/realtime_events", opendata.FDRealtime)
	g2.Get("/realtime_events/:area", opendata.FDRealtimeByArea)

	g3 := g.Group("/xcity")
	g3.Get("/actress", opendata.XCityActressList)
	g3.Get("/actress/detail/:id", opendata.XCityActressDetail)

	g4 := g.Group("/av")
	g4.Get("/search/video", opendata.AvVideoSearch)
	// 搜尋頁「篩選」：目前條件下的常見標籤／發售商／系列／出演
	g4.Get("/search/video/facets", opendata.AvVideoFacets)
	g4.Get("/search/actress", opendata.AvActressSearch)
	// 詳細頁「同步資料」：用 DMM 內部番號重抓單一作品（IP＋作品冷卻限流）
	g4.Post("/video/:no/sync", opendata.AvVideoSync)

	gVtuber := g.Group("/vtubers")
	gVtuber.Get("/channels", opendata.VtuberChannels)
	// search 要排在 :handle 前面，不然會被當成 handle
	gVtuber.Get("/channels/search", opendata.VtuberChannelSearch)
	gVtuber.Get("/channels/:handle", opendata.VtuberChannel)
	gVtuber.Get("/channels/:handle/stats", opendata.VtuberChannelStats)
	gVtuber.Get("/channels/:handle/videos", opendata.VtuberChannelVideos)
	gVtuber.Get("/channels/:handle/videos/search", opendata.VtuberChannelVideoSearch)
	gVtuber.Get("/lives", opendata.VtuberLives)
	gVtuber.Get("/videos/:video_id", opendata.VtuberVideo)

	gNCCC := g.Group("/nccc")
	gNCCC.Get("/indexes", opendata.NCCCIndexes)
	gNCCC.Get("/indexes/:token/records", opendata.NCCCRecords)

	g5 := g.Group("/financial")
	g51 := g5.Group("/twse")
	g51.Get("/code_list", opendata.TwseEtfCodeList)
	g51.Get("/upcoming/by_date", opendata.TwseUpcomingExETFByDate)

	// 登入 middleware 掛在每個路由自己身上，不透過 g51.Group("", middleware)
	// 建子群組：Fiber v3 的 Group("", middleware) 是用同一個 prefix 註冊一個
	// methodUse 中介層，之後在這個 prefix 底下註冊的路由（例如下面的 :code/share_info、
	// :code/ticker）都會先經過這個中介層，等於整個 /twse 都被要求要登入。
	g51.Get("/favorites", authsession.New(authService.BrandMain), opendata.TwseEtfFavorites)
	g51.Get("/favorites/batch", authsession.New(authService.BrandMain), opendata.TwseEtfFavoritesBatch)
	g51.Get("/favorites/realtime_price", authsession.New(authService.BrandMain), opendata.TwseEtfFavoritesRealtimePrices)
	g51.Post("/:code/favorite", authsession.New(authService.BrandMain), opendata.CreateTwseEtfFavorite)
	g51.Delete("/:code/favorite", authsession.New(authService.BrandMain), opendata.DeleteTwseEtfFavorite)
	g51.Get(
		"/:code/transactions",
		authsession.New(authService.BrandMain),
		opendata.TwseEtfSavedTransactions,
	)
	g51.Put(
		"/:code/transactions",
		authsession.New(authService.BrandMain),
		opendata.SaveTwseEtfSavedTransactions,
	)

	g51a := g51.Group("/:code")
	g51a.Get("/share_info", opendata.TwseEtfShareInfo)
	g51a.Get("/ticker", opendata.TwseEtfTicker)
}
