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
	authenticated.Get("/user", storyteller.UserProfile)
	authenticated.Post("/user", storyteller.SaveUserProfile)
	authenticated.Put("/user", storyteller.SaveUserProfile)
	authenticated.Delete("/user", storyteller.DeleteUserProfile)
	authenticated.Get("/projects", storyteller.Projects)
	authenticated.Post("/projects", storyteller.CreateProject)
	authenticated.Get("/favorites", storyteller.FavoriteProjects)
	authenticated.Get("/projects/:project", storyteller.Project)
	authenticated.Put("/projects/:project", storyteller.UpdateProject)
	authenticated.Delete("/projects/:project", storyteller.DeleteProject)
	authenticated.Get("/projects/:project/favorite", storyteller.FavoriteStatus)
	authenticated.Post("/projects/:project/favorite", storyteller.CreateFavorite)
	authenticated.Delete("/projects/:project/favorite", storyteller.DeleteFavorite)
	authenticated.Get("/projects/:project/ranking", storyteller.RankingStatus)
	authenticated.Put("/projects/:project/ranking", storyteller.SaveRanking)
	authenticated.Delete("/projects/:project/ranking", storyteller.DeleteRanking)

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
	authenticated.Get("/projects/:project/stories/:story/versions", storyteller.StoryVersions)
	authenticated.Get("/projects/:project/stories/:story/versions/:version", storyteller.StoryVersion)
}
