package sns

type RenderRequest struct {
	Path  string
	Query string
	// Host is the original browser-facing hostname (from X-Forwarded-Host),
	// used to tell a mirrored domain (steamloom.works) apart from the main site.
	Host string
}

type Meta struct {
	Title        string
	SiteName     string
	Description  string
	Canonical    string
	OpenGraphURL string
	Image        string
	Robots       string
	Type         string
	RedirectURL  string
}
