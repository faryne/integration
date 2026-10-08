package sns

type RenderRequest struct {
	Path  string
	Query string
	// Host is the original browser-facing hostname (from X-Forwarded-Host),
	// used to tell a mirrored domain (steamloom.works) apart from the main site.
	Host string
}

type Meta struct {
	// Status 是回給爬蟲的 HTTP 狀態碼；0 視為 200。私人／不存在的內容回 404，平台就不產生預覽卡。
	Status       int
	Title        string
	SiteName     string
	Description  string
	Canonical    string
	OpenGraphURL string
	Image        string
	// ImageWidth／ImageHeight 只有已知尺寸的圖（例如 1200×630 的 SteamLoom 圖卡）才填，0 就不輸出
	ImageWidth  int
	ImageHeight int
	Robots      string
	Type        string
	RedirectURL string
	// SiteURL 是 JSON-LD isPartOf 的網站網址，跟著網域走（SteamLoom 指 steamloom.works）
	SiteURL string
	// SchemaType 是 JSON-LD 的 @type，預設 WebPage；單篇故事／設定用 CreativeWork
	SchemaType string
	// AuthorName 有值時輸出成 JSON-LD 的 author（單篇故事、單則動態）
	AuthorName string
}
