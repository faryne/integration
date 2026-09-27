package storyteller

import "strings"

type AuditRouteRef struct {
	Method string
	Path   string
}

type AuditActionDefinition struct {
	Name       string
	Category   string
	Importance AuditImportance
	Routes     []AuditRouteRef
	Tools      []string
}

type AuditExemption struct {
	Kind       string
	Identifier string
	Reason     string
}

func route(method, path string) AuditRouteRef { return AuditRouteRef{Method: method, Path: path} }

// StorytellerAuditActions 是唯一的 action registry。upsert／patch 類工具會由 dispatch
// 依參數與變更內容解析成 create、update 或 visibility.change，但仍在此明確列出映射。
var StorytellerAuditActions = []AuditActionDefinition{
	{Name: "project.create", Category: "project", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/projects")}, Tools: []string{"storyteller_create_project"}},
	{Name: "project.update", Category: "project", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project")}, Tools: []string{"storyteller_patch_project"}},
	{Name: "project.delete", Category: "project", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/projects/:project")}},
	{Name: "project.visibility.change", Category: "project", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project")}, Tools: []string{"storyteller_patch_project"}},
	{Name: "project.share_token.regenerate", Category: "project", Importance: AuditImportanceHigh},

	{Name: "story.create", Category: "story", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/stories")}, Tools: []string{"storyteller_upsert_story", "storyteller_upsert_image_story"}},
	{Name: "story.update", Category: "story", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/stories/:story")}, Tools: []string{"storyteller_upsert_story", "storyteller_patch_story", "storyteller_search_replace_story", "storyteller_upsert_image_story"}},
	{Name: "story.delete", Category: "story", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/projects/:project/stories/:story")}, Tools: []string{"storyteller_delete_story"}},
	{Name: "story.move", Category: "story", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/stories/:story")}, Tools: []string{"storyteller_move_story", "storyteller_upsert_story", "storyteller_patch_story"}},
	{Name: "story.reorder", Category: "story", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/stories/:story")}, Tools: []string{"storyteller_upsert_story", "storyteller_patch_story", "storyteller_upsert_image_story"}},
	{Name: "story.revert", Category: "story", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/stories/:story/versions/:version/revert")}, Tools: []string{"storyteller_revert_story"}},

	{Name: "story_chapter.replace", Category: "story", Importance: AuditImportanceNormal, Tools: []string{"storyteller_replace_story_chapter"}},
	{Name: "story_chapter.insert", Category: "story", Importance: AuditImportanceNormal, Tools: []string{"storyteller_insert_story_chapter"}},
	{Name: "story_chapter.delete", Category: "story", Importance: AuditImportanceHigh, Tools: []string{"storyteller_delete_story_chapter"}},

	{Name: "volume.create", Category: "story", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/volumes")}, Tools: []string{"storyteller_create_volume"}},
	{Name: "volume.update", Category: "story", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/volumes/:volume")}, Tools: []string{"storyteller_update_volume"}},
	{Name: "volume.delete", Category: "story", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/projects/:project/stories/:story")}, Tools: []string{"storyteller_delete_volume"}},
	{Name: "volume.reorder", Category: "story", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/volumes/:volume")}, Tools: []string{"storyteller_update_volume"}},

	{Name: "lore.create", Category: "lore", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/lores")}, Tools: []string{"storyteller_upsert_lore"}},
	{Name: "lore.update", Category: "lore", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/lores/:lore")}, Tools: []string{"storyteller_upsert_lore", "storyteller_patch_lore", "storyteller_search_replace_lore"}},
	{Name: "lore.delete", Category: "lore", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/projects/:project/lores/:lore")}, Tools: []string{"storyteller_delete_lore"}},
	{Name: "lore.move", Category: "lore", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/lores/:lore/move")}, Tools: []string{"storyteller_move_lore"}},
	{Name: "lore.revert", Category: "lore", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/lores/:lore/versions/:version/revert")}, Tools: []string{"storyteller_revert_lore"}},

	{Name: "lore_collection.create", Category: "lore", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/lore-collections")}, Tools: []string{"storyteller_create_lore_collection"}},
	{Name: "lore_collection.update", Category: "lore", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/lore-collections/:collection")}, Tools: []string{"storyteller_update_lore_collection"}},
	{Name: "lore_collection.delete", Category: "lore", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/projects/:project/lore-collections/:collection")}, Tools: []string{"storyteller_delete_lore_collection"}},
	{Name: "lore_chapter.replace", Category: "lore", Importance: AuditImportanceNormal, Tools: []string{"storyteller_replace_lore_chapter"}},
	{Name: "lore_chapter.insert", Category: "lore", Importance: AuditImportanceNormal, Tools: []string{"storyteller_insert_lore_chapter"}},
	{Name: "lore_chapter.delete", Category: "lore", Importance: AuditImportanceHigh, Tools: []string{"storyteller_delete_lore_chapter"}},

	{Name: "asset.upload.confirm", Category: "asset", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/assets/confirm")}, Tools: []string{"storyteller_confirm_asset_upload"}},
	{Name: "asset.replace.confirm", Category: "asset", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/assets/:asset/replace/confirm")}, Tools: []string{"storyteller_confirm_asset_replace"}},
	{Name: "asset.update", Category: "asset", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/assets/:asset")}, Tools: []string{"storyteller_update_asset"}},
	{Name: "asset.move", Category: "asset", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/assets/:asset/move")}, Tools: []string{"storyteller_move_asset"}},
	{Name: "asset.delete", Category: "asset", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/projects/:project/assets/:asset")}, Tools: []string{"storyteller_delete_asset"}},
	{Name: "asset_collection.create", Category: "asset", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/asset-collections")}, Tools: []string{"storyteller_create_asset_collection"}},
	{Name: "asset_collection.update", Category: "asset", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/asset-collections/:collection")}, Tools: []string{"storyteller_update_asset_collection"}},
	{Name: "asset_collection.delete", Category: "asset", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/projects/:project/asset-collections/:collection")}, Tools: []string{"storyteller_delete_asset_collection"}},

	{Name: "project.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_projects"}},
	{Name: "project.read", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_get_project"}},
	{Name: "story.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_stories"}},
	{Name: "story.read", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_get_story", "storyteller_get_story_version"}},
	{Name: "story.version.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_story_versions"}},
	{Name: "story_chapter.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_story_chapters"}},
	{Name: "story_chapter.read", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_get_story_chapter"}},
	{Name: "volume.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_volumes"}},
	{Name: "lore.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_lores"}},
	{Name: "lore.read", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_get_lore", "storyteller_get_lore_version"}},
	{Name: "lore.version.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_lore_versions"}},
	{Name: "lore_collection.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_lore_collections"}},
	{Name: "lore_chapter.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_lore_chapters"}},
	{Name: "lore_chapter.read", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_get_lore_chapter"}},
	{Name: "asset.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_assets"}},
	{Name: "asset.read", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_get_asset"}},
	{Name: "asset_collection.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_asset_collections"}},
	{Name: "memory.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_memories"}},
	{Name: "memory.search", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_search_memories"}},
	{Name: "author_profile.list", Category: "read", Importance: AuditImportanceLow, Tools: []string{"storyteller_list_profiles"}},
}

// StorytellerAuditExemptions 將 P1 刻意不記的準備動作與 P2 操作留在覆蓋率檢查裡，
// 避免把「尚未做到」誤判成「開發者忘了映射」。
var StorytellerAuditExemptions = []AuditExemption{
	{Kind: "tool", Identifier: "storyteller_presign_asset_upload", Reason: "presign 是準備動作"},
	{Kind: "tool", Identifier: "storyteller_presign_asset_replace", Reason: "presign 是準備動作"},
	{Kind: "tool", Identifier: "storyteller_presign_image_upload", Reason: "presign 是準備動作"},
	{Kind: "tool", Identifier: "storyteller_create_profile", Reason: "author profile 寫入屬 P2"},
	{Kind: "tool", Identifier: "storyteller_update_profile", Reason: "author profile 寫入屬 P2"},
	{Kind: "tool", Identifier: "storyteller_delete_profile", Reason: "author profile 寫入屬 P2"},
	{Kind: "tool", Identifier: "storyteller_upsert_memory", Reason: "memory 寫入屬 P2"},

	{Kind: "route", Identifier: "POST /storyteller/auth/session", Reason: "auth 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/auth/dev-session", Reason: "開發登入且 auth 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/image-pages/presign", Reason: "presign 是準備動作"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/assets/presign", Reason: "presign 是準備動作"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/assets/:asset/replace/presign", Reason: "presign 是準備動作"},
	{Kind: "route", Identifier: "POST /storyteller-mcp", Reason: "MCP transport 由 tool mapping 個別覆蓋"},
	{Kind: "route", Identifier: "POST /storyteller/user", Reason: "profile 事件屬 P2"},
	{Kind: "route", Identifier: "PUT /storyteller/user", Reason: "profile 事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/user", Reason: "profile 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/profiles", Reason: "author profile 事件屬 P2"},
	{Kind: "route", Identifier: "PUT /storyteller/profiles/:profile", Reason: "author profile 事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/profiles/:profile", Reason: "author profile 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/authors/:author/favorite", Reason: "社交收藏事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/authors/:author/favorite", Reason: "社交收藏事件屬 P2"},
	{Kind: "route", Identifier: "PUT /storyteller/projects/:project/memories/:memory", Reason: "memory 事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/memories/:memory", Reason: "memory 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/favorite", Reason: "社交收藏事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/projects/:project/favorite", Reason: "社交收藏事件屬 P2"},
	{Kind: "route", Identifier: "PATCH /storyteller/favorites/projects/:project/visibility", Reason: "社交收藏事件屬 P2"},
	{Kind: "route", Identifier: "PATCH /storyteller/favorites/authors/:author/visibility", Reason: "社交收藏事件屬 P2"},
	{Kind: "route", Identifier: "PUT /storyteller/projects/:project/ranking", Reason: "社交評分事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/projects/:project/ranking", Reason: "社交評分事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/story/:project/stories/:story/bookmarks", Reason: "閱讀收藏事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/story/:project/stories/:story/bookmarks", Reason: "閱讀收藏事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/provider-apikeys", Reason: "credential 事件屬 P2"},
	{Kind: "route", Identifier: "PUT /storyteller/provider-apikeys/:apikey", Reason: "credential 事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/provider-apikeys/:apikey", Reason: "credential 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/provider-apikeys/:apikey/models", Reason: "credential 事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/provider-apikeys/:apikey/models/:model", Reason: "credential 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/provider-apikeys/:apikey/test-connection", Reason: "credential 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/personal-access-tokens", Reason: "credential 事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/personal-access-tokens/:token", Reason: "credential 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/agents", Reason: "AI assistant 事件屬 P2"},
	{Kind: "route", Identifier: "PUT /storyteller/agents/:agent", Reason: "AI assistant 事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/agents/:agent", Reason: "AI assistant 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/agent-chats", Reason: "AI assistant 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/agent-chats/:chat/resend", Reason: "AI assistant 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/agent-chats/:chat/memory-drafts", Reason: "memory 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/memory-drafts/:memory/retry", Reason: "memory 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/memory-drafts/:memory/confirm", Reason: "memory 事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/memory-drafts/:memory", Reason: "memory 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/agentic-proposals/:proposal/preview", Reason: "唯讀 preview 且 AI assistant 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/agentic-proposals/:proposal/apply", Reason: "AI assistant 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/agentic-proposals/:proposal/mark-applied", Reason: "AI assistant 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/agentic-proposals/:proposal/reset", Reason: "AI assistant 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/agentic-proposals/:proposal/reject", Reason: "AI assistant 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/stories/:story/bookmarks", Reason: "writing bookmark 事件屬 P2"},
	{Kind: "route", Identifier: "PUT /storyteller/projects/:project/stories/:story/bookmarks", Reason: "writing bookmark 事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/projects/:project/stories/:story/bookmarks", Reason: "writing bookmark 事件屬 P2"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/lores/:lore/bookmarks", Reason: "writing bookmark 事件屬 P2"},
	{Kind: "route", Identifier: "PUT /storyteller/projects/:project/lores/:lore/bookmarks", Reason: "writing bookmark 事件屬 P2"},
	{Kind: "route", Identifier: "DELETE /storyteller/projects/:project/lores/:lore/bookmarks", Reason: "writing bookmark 事件屬 P2"},
}

func AuditActionForRoute(method, path string) (AuditActionDefinition, bool) {
	for _, action := range StorytellerAuditActions {
		for _, candidate := range action.Routes {
			if strings.EqualFold(candidate.Method, method) && candidate.Path == path {
				return action, true
			}
		}
	}
	return AuditActionDefinition{}, false
}

func AuditActionForTool(name string) (AuditActionDefinition, bool) {
	for _, action := range StorytellerAuditActions {
		for _, tool := range action.Tools {
			if tool == name {
				return action, true
			}
		}
	}
	return AuditActionDefinition{}, false
}

func IsAuditExempt(kind, identifier string) bool {
	for _, exemption := range StorytellerAuditExemptions {
		if exemption.Kind == kind && exemption.Identifier == identifier {
			return true
		}
	}
	return false
}
