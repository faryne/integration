package vtuber

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"go.uber.org/zap"

	"faryne.dev/config"
	vtuberRepository "faryne.dev/repository/vtuber"
	"faryne.dev/service/log"
)

// legacyCalendarsURL Apps Script 時代的 Firebase：hololive/calendar 節點是 {"all": "<總表>", "UC...": "<個人行事曆>"}
const legacyCalendarsURL = "https://faryne-firebase.firebaseio.com/hololive/calendar.json"

var channelIDPattern = regexp.MustCompile(`^UC[A-Za-z0-9_-]{22}$`)

// ImportCalendars 從舊 Firebase 匯入 Apps Script 時代建好的個人行事曆，寫進 vtuber_channels.calendar_id。
// 要先跑過週更 job，名冊裡沒有的頻道會被略過。可以重跑，會覆蓋。
func ImportCalendars(ctx context.Context) (int64, error) {
	secret := strings.TrimSpace(config.EnvConfig().VtuberLegacyFirebaseSecret)
	if secret == "" {
		return 0, fmt.Errorf("VTUBER_LEGACY_FIREBASE_SECRET is required")
	}
	mapping, err := fetchLegacyCalendars(ctx, secret)
	if err != nil {
		return 0, err
	}
	calendars, all := legacyChannelCalendars(mapping)
	if all != AllCalendarID {
		log.Logger().Warn("Legacy all calendar differs from AllCalendarID", zap.String("legacy", all), zap.String("const", AllCalendarID))
	}
	matched, err := vtuberRepository.SetChannelCalendars(calendars)
	if err == nil && matched < int64(len(calendars)) {
		log.Logger().Info("Some legacy calendars have no matching channel", zap.Int("legacy", len(calendars)), zap.Int64("matched", matched))
	}
	return matched, err
}

func fetchLegacyCalendars(ctx context.Context, secret string) (map[string]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, legacyCalendarsURL+"?auth="+url.QueryEscape(secret), nil)
	if err != nil {
		return nil, err
	}
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		// url.Error 會帶完整網址（含 secret），只留底層錯誤
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			err = urlErr.Err
		}
		return nil, fmt.Errorf("fetch legacy firebase: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch legacy firebase: unexpected status %s", resp.Status)
	}
	var mapping map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&mapping); err != nil {
		return nil, fmt.Errorf("parse legacy firebase: %w", err)
	}
	return mapping, nil
}

// legacyChannelCalendars 拆出頻道 ID → 行事曆 ID 與總表 ID；不是頻道 ID 的 key 與空值略過
func legacyChannelCalendars(mapping map[string]string) (map[string]string, string) {
	calendars := make(map[string]string, len(mapping))
	for key, id := range mapping {
		if id = strings.TrimSpace(id); id != "" && channelIDPattern.MatchString(key) {
			calendars[key] = id
		}
	}
	return calendars, strings.TrimSpace(mapping["all"])
}

// RunImportCalendars -cmd vtuber-import-calendars 的進入點
func RunImportCalendars() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	count, err := ImportCalendars(ctx)
	if err != nil {
		log.Logger().Error("Import vtuber calendars failed", zap.Error(err))
		return
	}
	log.Logger().Info("Import vtuber calendars finished", zap.Int64("channels", count))
}
