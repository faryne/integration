package route

import (
	"faryne.dev/controller/storyteller"
	"faryne.dev/middleware/authsession"
	"github.com/gofiber/fiber/v3"
)

func Storyteller(app *fiber.App) {
	group := app.Group("/storyteller")
	group.Get("/projects/public", storyteller.PublicProjects)
	group.Get("/story/share/:token", storyteller.SharedProject)
	group.Get("/story/:project", storyteller.PublicProject)

	authenticated := group.Group("", authsession.New())
	authenticated.Get("/projects", storyteller.Projects)
	authenticated.Post("/projects", storyteller.CreateProject)
	authenticated.Get("/favorites", storyteller.FavoriteProjects)
	authenticated.Get("/projects/:project", storyteller.Project)
	authenticated.Put("/projects/:project", storyteller.UpdateProject)
	authenticated.Delete("/projects/:project", storyteller.DeleteProject)
	authenticated.Get("/projects/:project/favorite", storyteller.FavoriteStatus)
	authenticated.Post("/projects/:project/favorite", storyteller.CreateFavorite)
	authenticated.Delete("/projects/:project/favorite", storyteller.DeleteFavorite)

	authenticated.Get("/agents", storyteller.Agents)
	authenticated.Post("/agents", storyteller.CreateAgent)
	authenticated.Get("/agents/:agent", storyteller.Agent)
	authenticated.Put("/agents/:agent", storyteller.UpdateAgent)
	authenticated.Delete("/agents/:agent", storyteller.DeleteAgent)

	authenticated.Get("/projects/:project/stories", storyteller.Stories)
	authenticated.Post("/projects/:project/stories", storyteller.CreateStory)
	authenticated.Get("/projects/:project/stories/:story", storyteller.Story)
	authenticated.Put("/projects/:project/stories/:story", storyteller.UpdateStory)
	authenticated.Delete("/projects/:project/stories/:story", storyteller.DeleteStory)
}
