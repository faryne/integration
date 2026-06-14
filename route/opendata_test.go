package route

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/require"
)

func TestTaipowerOptionalRoutes(t *testing.T) {
	app := fiber.New()
	group := app.Group("/taipower/neighbor")
	group.Get("/cityarea/:cityarea/:year?/:month?", routeParams)
	group.Get("/unit/:unit/:year?/:month?", routeParams)
	group.Get("/:year?/:month?", routeParams)

	tests := []string{
		"/taipower/neighbor",
		"/taipower/neighbor/115",
		"/taipower/neighbor/115/5",
		"/taipower/neighbor/cityarea/高雄市",
		"/taipower/neighbor/cityarea/高雄市/115/5",
		"/taipower/neighbor/unit/測試單位",
		"/taipower/neighbor/unit/測試單位/115",
	}
	for _, path := range tests {
		t.Run(path, func(t *testing.T) {
			response, err := app.Test(httptest.NewRequest(http.MethodGet, path, nil))
			require.NoError(t, err)
			require.Equal(t, http.StatusNoContent, response.StatusCode)
		})
	}
}

func routeParams(ctx fiber.Ctx) error {
	return ctx.SendStatus(http.StatusNoContent)
}
