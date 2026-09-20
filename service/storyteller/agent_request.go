package storyteller

import (
	"encoding/json"
	"fmt"
	"html"
	"regexp"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// agentRequest 是一次 provider 呼叫的結構化內容，XML() 渲染成 user prompt：
//
//	<Request>
//	  <Context/> <Persona/> <Skill/> <Histories/> <References/> <Reply/> <Editor/> <Selection/> <Task/>
//	</Request>
//
// 穩定的（Context／Persona／Skill／歷史）放前面、每次都會變的（Task）放最後。
// DB 存的仍是各原始欄位，XML 只是送出當下的渲染結果，同時存進 user message 的
// metadata.request_xml（見 agentUserMessageMetadata）供分析／除錯。歷史每輪都從各列的
// content 重新渲染，不讀舊的 request_xml，否則會一層包一層。
type agentRequest struct {
	ProjectPublicID string
	Target          agentRunTarget
	PersonaName     string // 使用者建立的 Agent 名稱；沒有人設時留空
	Persona         string // Agent.DefaultPrompt；Agent 沒設定人設時留空
	Skill           string // 內建 skill 名稱（AgentRunMode）；一般對話留空
	SkillPrompt     string
	Histories       []agentHistory
	References      []agentReference
	// ReferencesByTool 為 true 時 <References> 只列標題與 token，讓模型按需用唯讀工具查；
	// false（沒帶工具）時把內容直接內嵌。
	ReferencesByTool bool
	Reply            string // 使用者按「回覆」時，被回覆那則訊息的完整內容
	Editor           string // 編輯器未儲存的全文
	Selection        string // 編輯器選取的文字
	Task             string // 使用者這次輸入的需求
}

type agentReference struct {
	Kind, Title, Token, Content string
}

type agentHistory struct {
	Role    string
	Content string
}

// agentRequestTagPattern 抓出我們自己的標籤名。使用者內文（故事、回覆、歷史）可能剛好
// 含 </Task> 之類的字串而破壞結構，所以只中和這幾個標籤名（< 換成 &lt;），其餘內文
// 保持原樣，不做整套 XML 跳脫，避免傷到故事文字。
var agentRequestTagPattern = regexp.MustCompile(`(?i)</?(Request|Context|Persona|Skill|Histories|History|References|Reference|Reply|Editor|Selection|Task)\b`)

func neutralizeAgentTags(s string) string {
	return agentRequestTagPattern.ReplaceAllStringFunc(s, func(m string) string { return "&lt;" + m[1:] })
}

func xmlAttr(name, value string) string {
	return fmt.Sprintf(` %s="%s"`, name, html.EscapeString(value))
}

// noInstructionTask 是使用者沒有補充指令時（例如純 /continue）的 Task 內容。
const noInstructionTask = "(No additional instruction was provided.)"

func (r agentRequest) XML() string {
	var b strings.Builder
	block := func(tag, attrs, body string) {
		if strings.TrimSpace(body) != "" {
			b.WriteString("<" + tag + attrs + ">\n" + neutralizeAgentTags(body) + "\n</" + tag + ">\n")
		}
	}
	b.WriteString("<Request>\n")
	b.WriteString("<Context" + xmlAttr("project_public_id", r.ProjectPublicID))
	if strings.TrimSpace(r.Target.PublicID) != "" {
		b.WriteString(xmlAttr("target_kind", string(r.Target.Kind)) + xmlAttr("target_public_id", r.Target.PublicID))
		if strings.TrimSpace(r.Target.Title) != "" {
			b.WriteString(xmlAttr("target_title", r.Target.Title))
		}
	}
	b.WriteString("/>\n")
	block("Persona", personaAttr(r.PersonaName), r.Persona)
	block("Skill", xmlAttr("name", r.Skill), r.SkillPrompt)
	if len(r.Histories) > 0 {
		b.WriteString("<Histories>\n")
		for _, h := range r.Histories {
			b.WriteString("<History" + xmlAttr("role", h.Role) + ">" + neutralizeAgentTags(h.Content) + "</History>\n")
		}
		b.WriteString("</Histories>\n")
	}
	if len(r.References) > 0 {
		b.WriteString("<References>\n")
		for _, ref := range r.References {
			if r.ReferencesByTool {
				b.WriteString("- Reference " + neutralizeAgentTags(ref.Kind+": "+ref.Title+" / Token: "+ref.Token) + "\n")
			} else {
				b.WriteString("<Reference" + xmlAttr("kind", ref.Kind) + xmlAttr("title", ref.Title) + xmlAttr("token", ref.Token) + ">\n" + neutralizeAgentTags(ref.Content) + "\n</Reference>\n")
			}
		}
		b.WriteString("</References>\n")
	}
	block("Reply", "", r.Reply)
	block("Editor", "", r.Editor)
	block("Selection", "", r.Selection)
	task := strings.TrimSpace(r.Task)
	if task == "" {
		task = noInstructionTask
	}
	block("Task", "", task)
	b.WriteString("</Request>")
	return b.String()
}

func personaAttr(name string) string {
	if strings.TrimSpace(name) == "" {
		return ""
	}
	return xmlAttr("name", name)
}

// buildAgenticRequest 組一般對話的 request：有歷史、可帶回覆內容，沒有 Skill。
func buildAgenticRequest(plan *agentRunPlan, userPrompt, replyContent string, histories []agentHistory) agentRequest {
	req := agentRequest{ProjectPublicID: plan.ProjectPublicID, Target: plan.Target, Histories: histories, Reply: strings.TrimSpace(replyContent), Task: userPrompt}
	req.applyPersona(plan.Agent)
	return req
}

// buildSkillRequest 組內建 skill（/rewrite 等）的 request：不帶歷史（單輪改寫不該被之前的
// 對話口吻影響），選取文字優先於全文，帶工具時 @ 參照抽成 References 讓模型按需查。
func buildSkillRequest(plan *agentRunPlan, input storytellerModel.AgentRunRequest, useTools bool) agentRequest {
	spec := agentSkills[input.Mode]
	req := agentRequest{
		ProjectPublicID: plan.ProjectPublicID, Target: plan.Target,
		Skill: string(input.Mode), SkillPrompt: skillCommonPrompt + "\n" + spec.OutputRule,
		Task: strings.TrimSpace(input.Instruction),
	}
	req.applyPersona(plan.Agent)
	for _, ref := range input.References {
		req.References = append(req.References, agentReference{Kind: ref.Kind, Title: ref.Title, Token: ref.Token, Content: ref.Content})
	}
	req.ReferencesByTool = useTools
	req.Reply = strings.TrimSpace(input.ReplyContent)
	if spec.NeedSelection && strings.TrimSpace(input.SelectedContent) != "" {
		req.Selection = input.SelectedContent
	} else {
		req.Editor = strings.TrimSpace(input.FullContent)
	}
	return req
}

// applyPersona 一律帶上 URL :agent 這個 Agent 的人設（沒設定 DefaultPrompt 就不輸出 <Persona>）。
func (r *agentRequest) applyPersona(agent *storytellerModel.Agent) {
	r.PersonaName, r.Persona = agent.Name, strings.TrimSpace(agent.DefaultPrompt)
}

// agentUserMessageMetadata 是 user message 的 metadata JSON：一般對話與 skill 共用同一個
// 形狀，mode 是「agentic_query」或 skill 名稱（見 RecentStoryAgenticMessages 依 mode 篩歷史、
// 前端依 mode 顯示 /指令標籤）。RequestXML 是送 provider 的完整 request 快照，只供分析／
// 除錯，list API 輸出時會被濾掉（見 repository 的 stripRequestXML）。
type agentUserMessageMetadata struct {
	Mode                  string                              `json:"mode"`
	ReplyReference        *agenticQueryReplyReferenceMetadata `json:"reply_reference,omitempty"`
	SelectedContent       string                              `json:"selected_content,omitempty"`
	SelectedContentLength int                                 `json:"selected_content_length,omitempty"`
	FullContentLength     int                                 `json:"full_content_length,omitempty"`
	// UseTools 記 skill 這次有沒有帶唯讀工具，重送（重放 RequestXML）時才知道要不要開 loop。
	UseTools   bool   `json:"use_tools,omitempty"`
	RequestXML string `json:"request_xml,omitempty"`
}

func (m agentUserMessageMetadata) JSON() string {
	body, err := json.Marshal(m)
	if err != nil {
		return `{"mode":"` + m.Mode + `"}`
	}
	return string(body)
}

func parseAgentUserMessageMetadata(metadata string) agentUserMessageMetadata {
	var m agentUserMessageMetadata
	_ = json.Unmarshal([]byte(metadata), &m)
	return m
}

// agenticQueryHistories 把撈出來的歷史訊息列（見 RecentStoryAgenticMessages／
// RecentLoreAgenticMessages）轉成 <History> 項目。曾經跑到步數上限或中途中止的舊紀錄，
// assistant 那則的 content 可能是空字串，這種整個 chat（一問一答）一起跳過，不把不完整的
// 紀錄餵給模型。純轉換，不碰 DB。
func agenticQueryHistories(rows []storytellerModel.StoryChatMessage) []agentHistory {
	byChat := make(map[uint64][]storytellerModel.StoryChatMessage, len(rows))
	order := make([]uint64, 0, len(rows))
	for _, row := range rows {
		if _, ok := byChat[row.ChatID]; !ok {
			order = append(order, row.ChatID)
		}
		byChat[row.ChatID] = append(byChat[row.ChatID], row)
	}
	histories := make([]agentHistory, 0, len(rows))
	for _, chatID := range order {
		chatRows := byChat[chatID]
		complete := len(chatRows) == 2 &&
			chatRows[0].Role == storytellerModel.ChatMessageRoleUser &&
			chatRows[1].Role == storytellerModel.ChatMessageRoleAssistant &&
			strings.TrimSpace(chatRows[0].Content) != "" && strings.TrimSpace(chatRows[1].Content) != ""
		if !complete {
			continue
		}
		for _, row := range chatRows {
			histories = append(histories, agentHistory{Role: string(row.Role), Content: row.Content})
		}
	}
	return histories
}
