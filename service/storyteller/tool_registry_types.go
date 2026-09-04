package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// storytellerContentSyntaxHint 描述編輯器實際支援的語法子集（不是完整 GFM，見
// wysiwygCore/parser.ts／whitelist.ts），只列「能用什麼」，不列「不能用什麼」——
// 沒提到的語法（待辦清單、標準 [text](url) 連結等）目前解析器不認得，
// 寫了會原樣顯示成文字，故意不在這裡列出來，agent 自然不會去用。新表格 2026-08-14
// 改成逐列一行的 `⟦table ...⟧` marker，取代舊的 pipe-only table-row；舊格式仍可讀，
// 但 AI agent 不應新增。
// 刪除線 2026-08-13 加入解析器支援，語法是 `--文字--`，故意不用 GFM 慣用的 `~~`，
// 因為 `~` 已經是這個編輯器的下標語法，兩者共用同一個字元會互相衝突。
const storytellerContentSyntaxHint = "Content uses this app's own limited markdown-like syntax, not full GFM: " +
	"headings (# through ######), **bold**, *italic*, ++underline++, --strikethrough--, ^superscript^, " +
	"~subscript~, blockquote (> text), bullet list (- item), ordered list (1. item), horizontal rule (a line " +
	"containing only ---), and tables. New tables use one bracket-marked row per line, for example " +
	"⟦table tableId=\"tbl_1\" rowId=\"row_1\"⟧| Character | Status |⟦/table⟧ followed immediately by more rows " +
	"with the same tableId; adjacent rows with the same tableId render as one table. Keep tableId and rowId as " +
	"stable opaque ids when editing existing rows; create simple unique ids when adding rows. In table cells, " +
	"escape a literal pipe as \\|, a literal backslash as \\\\, and a cell line break as \\n. Table cells may use " +
	"the same inline styles and bracket markers as normal text. Legacy pipe-only rows like |cell1|cell2| may " +
	"exist in old content; preserve them if editing nearby, but do not create new legacy table-row content. " +
	"Code blocks use standard GFM triple-backtick fences with an optional language tag and optional id attribute " +
	"on the opening fence, e.g. ```go id=\"...\"; the id is this block's bookmark anchor and must be preserved " +
	"when editing an existing code block. Treat code block content as literal text; do not add inline styling or " +
	"bracket markers inside it. " +
	"Note strikethrough uses -- (not GFM's ~~), because ~ is already this editor's subscript syntax. Anything " +
	"else is a plain paragraph."

// storytellerContentMarkerHint 說明內容裡可能出現的 bracket marker：footnote（讀者
// 看得到）、comment（只有作者看得到的私人註解），以及 block-level table row。行內
// 標記語法本身長得幾乎一樣，
// 只從字面看不出語意差異，MCP client 讀到 ⟦comment-...⟧ 這種字串容易誤判成沒看過的
// 亂碼直接砍掉或忽略；補上這段說明，讓 AI 讀寫時都知道怎麼處理：footnote 的錨定文字
// 跟腳注本身都要保留在原地，comment 則要當成「作者留給你的編輯指示」來讀（可以依照
// 註解內容調整寫法），但註解文字本身絕對不能出現在改寫後的正文或任何要給讀者看的
// 地方——這是跟 storytellerContentSyntaxHint 分開成獨立常數的原因，一個講格式語法，
// 一個講「這個東西代表什麼、能不能給讀者看」，混在一起描述容易讓 agent 抓不到重點。
//
// 2026-09-04 補上每個段落自己那層無屬性的 ⟦markerId⟧...⟦/markerId⟧ 包裹——這是編輯頁
// 「大綱與書籤」功能的定位錨點（見 backfillStoryMarkerIds），每一行段落都有，沒有
// footnote/comment 那種額外屬性，純粹字面上更容易被誤判成雜訊而被 AI 整段清掉。沒提醒
// 的話 AI 整篇重寫時很容易漏保留，段落文字沒變、id 卻換了一個，作者原本標的書籤就會
// 對不到段落（見 memory：使用者發現這個落差後主動確認的問題）。
const storytellerContentMarkerHint = "The content may also contain bracket markers written by the " +
	"web editor, both wrapping a run of text: ⟦footnote-<id> note=\"...\"⟧anchored text⟦/footnote-<id>⟧ and " +
	"⟦comment-<id> comment=\"...\" commentColor=\"...\"⟧highlighted text⟦/comment-<id>⟧ (id is an opaque generated " +
	"string; keep it as-is if you reproduce or move a marker). Footnotes are reader-facing: keep the anchored " +
	"text and the footnote wrapping intact when rewriting nearby text, unless the user asks you to remove that " +
	"footnote. Comments are private, author-only editorial notes that are never shown to readers — treat a " +
	"comment's text as an instruction from the author about how they want the highlighted span rewritten, but " +
	"never copy the comment's own text into the visible story content or surface it to anyone who isn't the " +
	"author. After addressing a comment it's fine to leave the marker in place (the author can review and " +
	"remove it later) unless you're explicitly asked to delete it. Table rows are block-level markers: " +
	"⟦table tableId=\"...\" rowId=\"...\"⟧| cell | cell |⟦/table⟧. Keep rows from the same table adjacent and keep " +
	"their tableId/rowId values stable when editing existing tables. Every other paragraph line (including " +
	"headings) is also wrapped in its own plain marker with no extra attributes: ⟦<id>⟧paragraph text⟦/<id>⟧ " +
	"(or ⟦<id> align=\"center\"⟧...⟦/<id>⟧ when the paragraph has explicit alignment). This id is the anchor the " +
	"web editor's outline panel and the author's writing bookmarks point to — it must stay attached to that " +
	"exact paragraph and never change, even when you rewrite the paragraph's wording, unless the whole paragraph " +
	"is being deleted outright. When you edit a paragraph, keep reusing its existing id in both the opening and " +
	"closing marker; when you add a brand new paragraph, wrap it in a fresh unique id the same way. Do not strip " +
	"these plain ⟦id⟧ wrappers thinking they're noise, and do not swap in a new id for a paragraph that still " +
	"exists — either breaks the author's existing bookmarks and outline entries pointing at that paragraph."

// storytellerProjectDetailListCap 是 storyteller_get_project 嵌進去的 story/lore
// 清單上限，避免專案很大時單次回應塞爆 agent 的 context；超過的部分要另外呼叫
// storyteller_list_stories/storyteller_list_lores 分頁拉。
const storytellerProjectDetailListCap = 50

type storytellerProjectSummary struct {
	PublicID    string    `json:"public_id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	Visibility  string    `json:"visibility"`
	Rating      string    `json:"rating"`
	Tags        []string  `json:"tags"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type storytellerStorySummary struct {
	PublicID string `json:"public_id"`
	Title    string `json:"title"`
	Summary  string `json:"summary"`
	Status   string `json:"status"`
	Sort     int    `json:"sort"`
	// ContentType 是 "text"（一般文字故事，storyteller_upsert_story／storyteller_get_story
	// 的 content 是文字）或 "image"（話，內容是圖片頁面，改用 storyteller_upsert_image_story
	// 寫入，storyteller_get_story 回應改看 pages 欄位，content 對這種故事是空的）。
	ContentType string    `json:"content_type"`
	WordCount   uint      `json:"word_count"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type storytellerLoreSummary struct {
	PublicID     string    `json:"public_id"`
	Title        string    `json:"title"`
	CollectionID string    `json:"collection_id,omitempty"`
	WordCount    uint      `json:"word_count"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type storytellerProjectDetail struct {
	storytellerProjectSummary
	// Stories/Lores 最多回 storytellerProjectDetailListCap 筆；StoryCount/LoreCount
	// 是這個專案實際總數，超過上限時代表還有更多，要另外呼叫
	// storyteller_list_stories/storyteller_list_lores 分頁拉。
	Stories    []storytellerStorySummary `json:"stories"`
	StoryCount int64                     `json:"story_count"`
	Lores      []storytellerLoreSummary  `json:"lores"`
	LoreCount  int64                     `json:"lore_count"`
}

type storytellerStoryListOutput struct {
	Stories    []storytellerStorySummary `json:"stories"`
	TotalCount int64                     `json:"total_count"`
	Page       int                       `json:"page"`
	PageSize   int                       `json:"page_size"`
}

type storytellerLoreListOutput struct {
	Lores      []storytellerLoreSummary `json:"lores"`
	TotalCount int64                    `json:"total_count"`
	Page       int                      `json:"page"`
	PageSize   int                      `json:"page_size"`
}

type storytellerStoryDetail struct {
	storytellerStorySummary
	// Content 只有 content_type=text 的故事會填值；content_type=image 的話這欄是空的，
	// 改看 Pages。
	Content string `json:"content,omitempty"`
	// Pages 只有 content_type=image 的故事（話）會填值：每一頁的 id/key/description/sort，
	// 加上簽過名、可以直接開啟查看的 image_url。key 要原樣保留、之後呼叫
	// storyteller_upsert_image_story 更新這一話時要用同一組 key 帶回去，不然這頁會被當
	// 成新頁面處理（其實還是同一個 S3 物件，只是書籤等關聯資料會對不上舊的 id）。
	Pages []storytellerModel.StoryImagePageOutput `json:"pages,omitempty"`
	// VersionID 是這次回傳內容對應的版本 id，寫回時帶成 base_version_id 可以讓後端
	// 檢查內容有沒有被別的呼叫端動過（例如網頁編輯頁同時在編輯）。
	VersionID uint64 `json:"version_id"`
	// VersionConflict 只在 upsert 時可能為 true：代表帶入的 base_version_id 已經
	// 不是最新版本，但內容依然照常寫入、接在最新版本後面，沒有被拒絕或蓋掉；
	// 建議重新呼叫 storyteller_get_story 確認有沒有需要一併處理的內容。
	VersionConflict bool `json:"version_conflict,omitempty"`
}

type storytellerLoreDetail struct {
	storytellerLoreSummary
	Content         string `json:"content"`
	VersionID       uint64 `json:"version_id"`
	VersionConflict bool   `json:"version_conflict,omitempty"`
}

func toStorytellerProjectSummary(project storytellerModel.ProjectOutput) storytellerProjectSummary {
	return storytellerProjectSummary{
		PublicID:    project.PublicID,
		Name:        project.Name,
		Slug:        project.Slug,
		Description: project.Description,
		Visibility:  string(project.Visibility),
		Rating:      string(project.Rating),
		Tags:        project.TagList,
		UpdatedAt:   project.UpdatedAt,
	}
}

func toStorytellerStorySummary(story storytellerModel.Story) storytellerStorySummary {
	return storytellerStorySummary{
		PublicID:    story.PublicID,
		Title:       story.Title,
		Summary:     story.Summary,
		Status:      string(story.Status),
		Sort:        story.Sort,
		ContentType: string(story.ContentType),
		WordCount:   story.WordCount,
		UpdatedAt:   story.UpdatedAt,
	}
}

func toStorytellerLoreSummary(lore storytellerModel.Lore) storytellerLoreSummary {
	return storytellerLoreSummary{
		PublicID:     lore.PublicID,
		Title:        lore.Title,
		CollectionID: lore.CollectionPublicID,
		WordCount:    lore.WordCount,
		UpdatedAt:    lore.UpdatedAt,
	}
}

func derefUint64(v *uint64) uint64 {
	if v == nil {
		return 0
	}
	return *v
}
