package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

const protocolVersion = "2024-11-05"

type Server struct {
	name    string
	version string
	tools   map[string]Tool
}

type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	InputSchema map[string]interface{} `json:"inputSchema"`
	Handler     ToolHandler            `json:"-"`
}

type ToolHandler func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error)

type CallToolResult struct {
	Content []Content `json:"content"`
	IsError bool      `json:"isError,omitempty"`
}

type Content struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  interface{}     `json:"result,omitempty"`
	Error   *responseError  `json:"error,omitempty"`
}

type responseError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type toolCallParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

func NewServer(name, version string) *Server {
	s := newBareServer(name, version)
	s.registerBuiltInTools()
	s.registerAVTools()
	s.registerNekomaidTools()
	return s
}

func newBareServer(name, version string) *Server {
	return &Server{
		name:    name,
		version: version,
		tools:   make(map[string]Tool),
	}
}

func (s *Server) RegisterTool(tool Tool) error {
	if strings.TrimSpace(tool.Name) == "" {
		return errors.New("tool name is required")
	}
	if tool.InputSchema == nil {
		tool.InputSchema = objectSchema(nil, nil)
	}
	if tool.Handler == nil {
		return fmt.Errorf("tool %q handler is required", tool.Name)
	}
	s.tools[tool.Name] = tool
	return nil
}

func (s *Server) HandleJSONRPC(ctx context.Context, body []byte) (response, bool, error) {
	var req request
	if err := json.Unmarshal(body, &req); err != nil {
		return errorResponse(nil, -32700, "parse error"), true, nil
	}
	resp, shouldReply := s.handle(ctx, req)
	return resp, shouldReply, nil
}

func (s *Server) handle(ctx context.Context, req request) (response, bool) {
	if len(req.ID) == 0 {
		// JSON-RPC notifications do not receive responses. The MCP initialized
		// notification is intentionally accepted as a no-op.
		return response{}, false
	}

	switch req.Method {
	case "initialize":
		return successResponse(req.ID, map[string]interface{}{
			"protocolVersion": protocolVersion,
			"capabilities": map[string]interface{}{
				"tools": map[string]interface{}{},
			},
			"serverInfo": map[string]string{
				"name":    s.name,
				"version": s.version,
			},
		}), true
	case "tools/list":
		tools := make([]Tool, 0, len(s.tools))
		names := make([]string, 0, len(s.tools))
		for name := range s.tools {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			tool := s.tools[name]
			tools = append(tools, Tool{
				Name:        tool.Name,
				Description: tool.Description,
				InputSchema: tool.InputSchema,
			})
		}
		return successResponse(req.ID, map[string]interface{}{"tools": tools}), true
	case "tools/call":
		var params toolCallParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return errorResponse(req.ID, -32602, "invalid params"), true
		}
		tool, ok := s.tools[params.Name]
		if !ok {
			return errorResponse(req.ID, -32602, "unknown tool: "+params.Name), true
		}
		if params.Arguments == nil {
			params.Arguments = map[string]interface{}{}
		}
		result, err := tool.Handler(ctx, params.Arguments)
		if err != nil {
			return successResponse(req.ID, CallToolResult{
				Content: []Content{{Type: "text", Text: err.Error()}},
				IsError: true,
			}), true
		}
		return successResponse(req.ID, result), true
	default:
		return errorResponse(req.ID, -32601, "method not found: "+req.Method), true
	}
}

func (s *Server) registerBuiltInTools() {
	_ = s.RegisterTool(Tool{
		Name:        "ping",
		Description: "Return a basic liveness response from the MCP server.",
		InputSchema: objectSchema(nil, nil),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			return textResult("pong"), nil
		},
	})
}

func textResult(text string) *CallToolResult {
	return &CallToolResult{
		Content: []Content{{Type: "text", Text: text}},
	}
}

func objectSchema(properties map[string]interface{}, required []string) map[string]interface{} {
	schema := map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
	}
	if properties != nil {
		schema["properties"] = properties
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

func successResponse(id json.RawMessage, result interface{}) response {
	return response{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	}
}

func errorResponse(id json.RawMessage, code int, message string) response {
	return response{
		JSONRPC: "2.0",
		ID:      id,
		Error: &responseError{
			Code:    code,
			Message: message,
		},
	}
}
