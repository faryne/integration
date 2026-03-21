package crawler

type SelectorRequest struct {
	Name     string            `json:"name"`
	Pattern  string            `json:"pattern"`         // html xpath
	Multiple bool              `json:"multiple"`        // 是否可為多？
	Attrs    []string          `json:"attrs,omitempty"` // 要抓取的屬性
	Children []SelectorRequest `json:"child"`           // 子元素
	Trim     bool              `json:"trim"`            // 是否要做 string trim
}

type SelectorResult map[string]any // might be SelectorResponse or []SelectorResponse

type SelectorResponse struct {
	Html     *string        `json:"html,omitempty"`
	Text     *string        `json:"text,omitempty"`
	Attrs    map[string]any `json:"attrs,omitempty"`
	Children map[string]any `json:"children,omitempty"`
}
