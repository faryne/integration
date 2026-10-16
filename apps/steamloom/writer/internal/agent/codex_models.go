package agent

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

const codexModelsTimeout = 15 * time.Second

// CodexReasoningEffort 是特定 model 宣告支援的推理等級。
type CodexReasoningEffort struct {
	ID          string `json:"id"`
	Description string `json:"description"`
}

// CodexModel 直接反映本機 Codex app-server model/list 的可見選項。
type CodexModel struct {
	ID                        string                 `json:"id"`
	DisplayName               string                 `json:"display_name"`
	Description               string                 `json:"description"`
	IsDefault                 bool                   `json:"is_default"`
	DefaultReasoningEffort    string                 `json:"default_reasoning_effort"`
	SupportedReasoningEfforts []CodexReasoningEffort `json:"supported_reasoning_efforts"`
}

type codexRPCResponse struct {
	ID     json.RawMessage `json:"id"`
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type codexModelRow struct {
	ID                     string `json:"id"`
	Model                  string `json:"model"`
	DisplayName            string `json:"displayName"`
	Description            string `json:"description"`
	Hidden                 bool   `json:"hidden"`
	IsDefault              bool   `json:"isDefault"`
	DefaultReasoningEffort string `json:"defaultReasoningEffort"`
	SupportedEfforts       []struct {
		ReasoningEffort string `json:"reasoningEffort"`
		Description     string `json:"description"`
	} `json:"supportedReasoningEfforts"`
}

type codexModelListResponse struct {
	Data       []codexModelRow `json:"data"`
	NextCursor *string         `json:"nextCursor"`
}

// CodexModels 只讀本機 Codex catalog；實際帳號權限仍以該輪 inference 成功與否為準。
func CodexModels(parent context.Context) ([]CodexModel, error) {
	bin, ok := lookup("codex")
	if !ok {
		return nil, errors.New("這台電腦沒有安裝 Codex")
	}
	if parent == nil {
		parent = context.Background()
	}
	ctx, cancel := context.WithTimeout(parent, codexModelsTimeout)
	defer cancel()
	models, err := readCodexModels(ctx, bin)
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return nil, errors.New("取得 Codex model 清單逾時，請重試")
	}
	return models, err
}

func readCodexModels(ctx context.Context, bin string) ([]CodexModel, error) {
	cmd := exec.CommandContext(ctx, bin, "app-server", "--listen", "stdio://")
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	defer func() {
		_ = stdin.Close()
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = cmd.Wait()
	}()

	encoder := json.NewEncoder(stdin)
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
	if err := encoder.Encode(map[string]any{
		"id": 1, "method": "initialize",
		"params": map[string]any{"clientInfo": map[string]string{"name": "steamloom_writer", "title": "SteamLoom Writer", "version": "1"}},
	}); err != nil {
		return nil, err
	}
	var initialized struct{}
	if err := readCodexRPC(scanner, 1, &initialized); err != nil {
		return nil, codexModelError(err, stderr.String())
	}
	if err := encoder.Encode(map[string]any{"method": "initialized"}); err != nil {
		return nil, err
	}

	models := []CodexModel{}
	var cursor *string
	for id := 2; ; id++ {
		params := map[string]any{"includeHidden": false}
		if cursor != nil {
			params["cursor"] = *cursor
		}
		if err := encoder.Encode(map[string]any{"id": id, "method": "model/list", "params": params}); err != nil {
			return nil, err
		}
		var page codexModelListResponse
		if err := readCodexRPC(scanner, id, &page); err != nil {
			return nil, codexModelError(err, stderr.String())
		}
		models = append(models, normalizeCodexModels(page.Data)...)
		cursor = page.NextCursor
		if cursor == nil || *cursor == "" {
			break
		}
	}
	if len(models) == 0 {
		return nil, errors.New("Codex 沒有回傳可用的 model")
	}
	return models, nil
}

func readCodexRPC(scanner *bufio.Scanner, id int, target any) error {
	for scanner.Scan() {
		var response codexRPCResponse
		if json.Unmarshal(scanner.Bytes(), &response) != nil || len(response.ID) == 0 {
			continue // app-server notification 與指定 request 無關。
		}
		var responseID int
		if json.Unmarshal(response.ID, &responseID) != nil || responseID != id {
			continue
		}
		if response.Error != nil {
			return fmt.Errorf("Codex app-server (%d): %s", response.Error.Code, response.Error.Message)
		}
		if len(response.Result) == 0 {
			return errors.New("Codex app-server 沒有回傳結果")
		}
		return json.Unmarshal(response.Result, target)
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return errors.New("Codex app-server 已結束")
}

func normalizeCodexModels(rows []codexModelRow) []CodexModel {
	models := make([]CodexModel, 0, len(rows))
	for _, row := range rows {
		id := strings.TrimSpace(row.Model)
		if id == "" {
			id = strings.TrimSpace(row.ID)
		}
		if row.Hidden || id == "" {
			continue
		}
		name := strings.TrimSpace(row.DisplayName)
		if name == "" {
			name = id
		}
		model := CodexModel{ID: id, DisplayName: name, Description: strings.TrimSpace(row.Description), IsDefault: row.IsDefault, DefaultReasoningEffort: strings.TrimSpace(row.DefaultReasoningEffort)}
		for _, effort := range row.SupportedEfforts {
			if value := strings.TrimSpace(effort.ReasoningEffort); value != "" {
				model.SupportedReasoningEfforts = append(model.SupportedReasoningEfforts, CodexReasoningEffort{ID: value, Description: strings.TrimSpace(effort.Description)})
			}
		}
		models = append(models, model)
	}
	return models
}

func codexModelError(err error, stderr string) error {
	detail := strings.TrimSpace(stderr)
	if detail == "" {
		return err
	}
	return fmt.Errorf("%w: %s", err, detail)
}
