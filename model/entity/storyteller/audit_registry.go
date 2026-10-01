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

	{Name: "auth.login", Category: "auth", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/auth/session")}},
	{Name: "auth.login.failed", Category: "auth", Importance: AuditImportanceHigh},
	{Name: "auth.logout", Category: "auth", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/auth/session")}},
	{Name: "auth.pat.denied", Category: "auth", Importance: AuditImportanceHigh},
	{Name: "auth.oauth.denied", Category: "auth", Importance: AuditImportanceHigh},
	// refresh token 已撤銷、已被輪替、過期或 client 不符；拿舊 refresh token 來換通常代表外洩或多處共用。
	{Name: "auth.oauth.refresh.denied", Category: "auth", Importance: AuditImportanceHigh},
	{Name: "pat.create", Category: "credential", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/personal-access-tokens")}},
	{Name: "pat.revoke", Category: "credential", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/personal-access-tokens/:token")}},
	// 授權頁按「允許」記 oauth.authorize，按「拒絕」由 Web middleware 解析成 oauth.deny（同一條路由）。
	{Name: "oauth.authorize", Category: "credential", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/oauth/authorize")}},
	{Name: "oauth.deny", Category: "credential", Importance: AuditImportanceNormal},
	// 應用程式用授權碼換到 token、正式建立授權時記。
	{Name: "oauth.grant.create", Category: "credential", Importance: AuditImportanceHigh},
	// access token 過期後用 refresh token 換新的一組時記；效期內提早 refresh 拿回原本那支，不記。
	{Name: "oauth.token.refresh", Category: "credential", Importance: AuditImportanceLow},
	// 「開發者 › OAuth Token」頁撤銷與應用程式自己呼叫 /oauth/revoke 都記，summary 的 revoked_by 區分。
	{Name: "oauth.revoke", Category: "credential", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/oauth/grants/:grant")}},
	{Name: "provider_key.create", Category: "credential", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/provider-apikeys")}},
	{Name: "provider_key.update", Category: "credential", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{
		route("PUT", "/storyteller/provider-apikeys/:apikey"), route("POST", "/storyteller/provider-apikeys/:apikey/models"), route("DELETE", "/storyteller/provider-apikeys/:apikey/models/:model"),
	}},
	{Name: "provider_key.delete", Category: "credential", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/provider-apikeys/:apikey")}},
	{Name: "provider_key.test", Category: "credential", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/provider-apikeys/:apikey/test-connection")}},

	{Name: "profile.update", Category: "profile", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/user"), route("PUT", "/storyteller/user")}},
	{Name: "profile.delete", Category: "profile", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/user")}},
	{Name: "author_profile.create", Category: "profile", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/profiles")}, Tools: []string{"storyteller_create_profile"}},
	{Name: "author_profile.update", Category: "profile", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/profiles/:profile")}, Tools: []string{"storyteller_update_profile"}},
	{Name: "author_profile.delete", Category: "profile", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/profiles/:profile")}, Tools: []string{"storyteller_delete_profile"}},
	{Name: "agent_skill.create", Category: "agent", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/agents")}},
	{Name: "agent_skill.update", Category: "agent", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/agents/:agent")}},
	{Name: "agent_skill.delete", Category: "agent", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/agents/:agent")}},

	{Name: "agent.run", Category: "agent", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/agent-chats")}},
	{Name: "agent.resend", Category: "agent", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/agent-chats/:chat/resend")}},
	{Name: "agent.proposal.apply", Category: "agent", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/agentic-proposals/:proposal/apply"), route("POST", "/storyteller/projects/:project/agentic-proposals/:proposal/mark-applied")}},
	{Name: "agent.proposal.reject", Category: "agent", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/agentic-proposals/:proposal/reject")}},
	{Name: "agent.proposal.reset", Category: "agent", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/agentic-proposals/:proposal/reset")}},

	{Name: "memory.create", Category: "memory", Importance: AuditImportanceNormal, Tools: []string{"storyteller_upsert_memory"}},
	{Name: "memory.draft.generate", Category: "memory", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/agent-chats/:chat/memory-drafts")}},
	{Name: "memory.confirm", Category: "memory", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/memory-drafts/:memory/confirm")}},
	{Name: "memory.update", Category: "memory", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/memories/:memory")}, Tools: []string{"storyteller_upsert_memory"}},
	{Name: "memory.delete", Category: "memory", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("DELETE", "/storyteller/memories/:memory")}},
	{Name: "memory.draft.discard", Category: "memory", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("DELETE", "/storyteller/memory-drafts/:memory")}},
	{Name: "memory.draft.retry", Category: "memory", Importance: AuditImportanceHigh, Routes: []AuditRouteRef{route("POST", "/storyteller/memory-drafts/:memory/retry")}},

	{Name: "favorite.add", Category: "social", Importance: AuditImportanceLow, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/favorite"), route("POST", "/storyteller/authors/:author/favorite")}},
	{Name: "favorite.remove", Category: "social", Importance: AuditImportanceLow, Routes: []AuditRouteRef{route("DELETE", "/storyteller/projects/:project/favorite"), route("DELETE", "/storyteller/authors/:author/favorite")}},
	{Name: "favorite.visibility.update", Category: "social", Importance: AuditImportanceLow, Routes: []AuditRouteRef{route("PATCH", "/storyteller/favorites/projects/:project/visibility"), route("PATCH", "/storyteller/favorites/authors/:author/visibility")}},
	{Name: "ranking.update", Category: "social", Importance: AuditImportanceLow, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/ranking")}},
	{Name: "ranking.delete", Category: "social", Importance: AuditImportanceLow, Routes: []AuditRouteRef{route("DELETE", "/storyteller/projects/:project/ranking")}},
	{Name: "bookmark.add", Category: "social", Importance: AuditImportanceLow, Routes: []AuditRouteRef{route("POST", "/storyteller/story/:project/stories/:story/bookmarks")}},
	{Name: "bookmark.remove", Category: "social", Importance: AuditImportanceLow, Routes: []AuditRouteRef{route("DELETE", "/storyteller/story/:project/stories/:story/bookmarks")}},
	{Name: "bookmark.create", Category: "social", Importance: AuditImportanceLow, Routes: []AuditRouteRef{route("POST", "/storyteller/projects/:project/stories/:story/bookmarks"), route("POST", "/storyteller/projects/:project/lores/:lore/bookmarks")}},
	{Name: "bookmark.update", Category: "social", Importance: AuditImportanceLow, Routes: []AuditRouteRef{route("PUT", "/storyteller/projects/:project/stories/:story/bookmarks"), route("PUT", "/storyteller/projects/:project/lores/:lore/bookmarks")}},
	{Name: "bookmark.delete", Category: "social", Importance: AuditImportanceLow, Routes: []AuditRouteRef{route("DELETE", "/storyteller/projects/:project/stories/:story/bookmarks"), route("DELETE", "/storyteller/projects/:project/lores/:lore/bookmarks")}},

	{Name: "system.memory_draft.cleanup", Category: "system", Importance: AuditImportanceNormal},
	{Name: "system.agent_model.sync", Category: "system", Importance: AuditImportanceNormal},
	{Name: "system.audit.export", Category: "system", Importance: AuditImportanceNormal},
	{Name: "system.audit.mysql_purge", Category: "system", Importance: AuditImportanceNormal},
	{Name: "system.audit.archive_purge", Category: "system", Importance: AuditImportanceHigh},

	// 封存查詢會實際花 Athena 掃描費用，屬於「花了使用者的錢或額度」，要記。
	{Name: "audit.archive_query.create", Category: "audit", Importance: AuditImportanceNormal, Routes: []AuditRouteRef{route("POST", "/storyteller/account/audit-archive-queries")}},

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

// StorytellerAuditExemptions 只保留沒有實際寫入的準備、transport 與唯讀動作。
var StorytellerAuditExemptions = []AuditExemption{
	{Kind: "tool", Identifier: "storyteller_presign_asset_upload", Reason: "presign 是準備動作"},
	{Kind: "tool", Identifier: "storyteller_presign_asset_replace", Reason: "presign 是準備動作"},
	{Kind: "tool", Identifier: "storyteller_presign_image_upload", Reason: "presign 是準備動作"},
	{Kind: "route", Identifier: "POST /storyteller/auth/dev-session", Reason: "只供本機測試的登入 bypass"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/image-pages/presign", Reason: "presign 是準備動作"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/assets/presign", Reason: "presign 是準備動作"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/assets/:asset/replace/presign", Reason: "presign 是準備動作"},
	{Kind: "route", Identifier: "POST /storyteller-mcp", Reason: "MCP transport 由 tool mapping 個別覆蓋"},
	{Kind: "route", Identifier: "POST /storyteller/projects/:project/agentic-proposals/:proposal/preview", Reason: "只計算預覽內容，不寫入資料"},
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

// AuditActionByName 供查詢端把事件上的 action 對回 registry，取得類別與重要度；
// registry 沒有的舊 action（例如之後改名）回傳 false，由呼叫端當成一般重要度處理。
func AuditActionByName(name string) (AuditActionDefinition, bool) {
	for _, action := range StorytellerAuditActions {
		if action.Name == name {
			return action, true
		}
	}
	return AuditActionDefinition{}, false
}

// AuditActionNames 依類別或重要度篩出 action 名稱，給查詢端轉成 SQL 的 IN／NOT IN 條件；
// category／importance 留空代表不限制該條件。
func AuditActionNames(category string, importance AuditImportance) []string {
	names := make([]string, 0)
	for _, action := range StorytellerAuditActions {
		if (category == "" || action.Category == category) && (importance == "" || action.Importance == importance) {
			names = append(names, action.Name)
		}
	}
	return names
}

// AuditCategories 依 registry 出現順序回傳不重複的類別，供篩選選項使用。
func AuditCategories() []string {
	seen, categories := map[string]bool{}, make([]string, 0)
	for _, action := range StorytellerAuditActions {
		if !seen[action.Category] {
			seen[action.Category] = true
			categories = append(categories, action.Category)
		}
	}
	return categories
}

func IsAuditExempt(kind, identifier string) bool {
	for _, exemption := range StorytellerAuditExemptions {
		if exemption.Kind == kind && exemption.Identifier == identifier {
			return true
		}
	}
	return false
}
