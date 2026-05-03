package route

import (
	"faryne.dev/controller/opendata"
	"github.com/gofiber/fiber/v3"
)

func OpenData(app *fiber.App) {
	g := app.Group("/opendata")

	g1 := g.Group("/rates")
	g1.Get("", opendata.Rate)
	g1.Get("/banks", opendata.Banks)
	g1.Get("/currencies", opendata.Currencies)

	g2 := g.Group("/fd")
	g2.Get("", opendata.FetchNtpcFDEvents)
	g2.Get("/units", opendata.FetchNtpcFDUnits)
	g2.Get("/realtime_events", opendata.FDRealtime)

	g3 := g.Group("/xcity")
	g3.Get("/actress", opendata.XCityActressList)
	g3.Get("/actress/detail/:id", opendata.XCityActressDetail)

	g4 := g.Group("/av")
	g4.Get("/search/video", opendata.AvVideoSearch)
	g4.Get("/search/actress", opendata.AvActressSearch)

	g5 := g.Group("/financial")
	g51 := g5.Group("/twse")
	g51.Get("/code_list", opendata.TwseEtfCodeList)
	g51.Get("/share_info/:code", opendata.TwseEtfShareInfo)
}
