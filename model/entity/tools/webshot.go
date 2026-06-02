package tools

type WebshotRequest struct {
	Url string `json:"url" validate:"required,http_url"`
}

type WebshotGetURIRequest struct {
	Hash string `uri:"hash" validate:"required,len=64,hexadecimal"`
}
