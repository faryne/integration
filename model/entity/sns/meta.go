package sns

type RenderRequest struct {
	Path  string
	Query string
}

type Meta struct {
	Title        string
	Description  string
	Canonical    string
	OpenGraphURL string
	Image        string
	Robots       string
	Type         string
	RedirectURL  string
}
