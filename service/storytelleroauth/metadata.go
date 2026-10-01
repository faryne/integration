package storytelleroauth

// ResourceMetadataURL 會放進 MCP 401 回應的 WWW-Authenticate，client 從這裡開始探索。
func (s *Service) ResourceMetadataURL() string {
	return s.issuer + "/.well-known/oauth-protected-resource"
}

// ProtectedResourceMetadata 是 RFC 9728 的 protected resource metadata。
func (s *Service) ProtectedResourceMetadata() map[string]any {
	return map[string]any{
		"resource":                 s.Resource(),
		"authorization_servers":    []string{s.issuer},
		"bearer_methods_supported": []string{"header"},
		"resource_name":            "Steamloom",
	}
}

// AuthorizationServerMetadata 是 RFC 8414 的 authorization server metadata；
// authorization_endpoint 指向前端 SPA 授權頁（session 在 header，後端無法直接渲染）。
func (s *Service) AuthorizationServerMetadata() map[string]any {
	return map[string]any{
		"issuer":                                         s.issuer,
		"authorization_endpoint":                         s.issuer + "/oauth/authorize",
		"token_endpoint":                                 s.issuer + "/oauth/token",
		"registration_endpoint":                          s.issuer + "/oauth/register",
		"revocation_endpoint":                            s.issuer + "/oauth/revoke",
		"response_types_supported":                       []string{"code"},
		"grant_types_supported":                          []string{"authorization_code", "refresh_token"},
		"code_challenge_methods_supported":               []string{"S256"},
		"token_endpoint_auth_methods_supported":          []string{"none"},
		"revocation_endpoint_auth_methods_supported":     []string{"none"},
		"authorization_response_iss_parameter_supported": true,
		// 目前不做 scope，token 可以操作帳號下所有專案
		"scopes_supported": []string{},
	}
}
