package route

import (
	"faryne.dev/controller/opendata"
	"faryne.dev/middleware/authsession"
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
	g4.Get("/search/actress", opendata.AvActressSearch)

	gNCCC := g.Group("/nccc")
	gNCCC.Get("/indexes", opendata.NCCCIndexes)
	gNCCC.Get("/indexes/:token/records", opendata.NCCCRecords)

	g5 := g.Group("/financial")
	g51 := g5.Group("/twse")
	g51.Get("/code_list", opendata.TwseEtfCodeList)
	g51.Get("/upcoming/by_date", opendata.TwseUpcomingExETFByDate)

	// authsession.New() 掛在每個路由自己身上，不透過 g51.Group("", authsession.New())
	// 建子群組：Fiber v3 的 Group("", middleware) 是用同一個 prefix 註冊一個
	// methodUse 中介層，之後在這個 prefix 底下註冊的路由（例如下面的 :code/share_info、
	// :code/ticker）都會先經過這個中介層，等於整個 /twse 都被要求要登入。
	g51.Get("/favorites", authsession.New(), opendata.TwseEtfFavorites)
	g51.Get("/favorites/batch", authsession.New(), opendata.TwseEtfFavoritesBatch)
	g51.Post("/:code/favorite", authsession.New(), opendata.CreateTwseEtfFavorite)
	g51.Delete("/:code/favorite", authsession.New(), opendata.DeleteTwseEtfFavorite)
	g51.Get(
		"/:code/transactions",
		authsession.New(),
		opendata.TwseEtfSavedTransactions,
	)
	g51.Put(
		"/:code/transactions",
		authsession.New(),
		opendata.SaveTwseEtfSavedTransactions,
	)

	g51a := g51.Group("/:code")
	g51a.Get("/share_info", opendata.TwseEtfShareInfo)
	g51a.Get("/ticker", opendata.TwseEtfTicker)
}
