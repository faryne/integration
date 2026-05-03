package google

import (
	"context"
	"fmt"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
	"os"
)

// CalendarEvent 抽象化結構
type CalendarEvent struct {
	ID          string
	Summary     string
	Description string
	Start       string // "YYYY-MM-DD"
	End         string // "YYYY-MM-DD"
}

type GoogleCalendarService struct {
	srv        *calendar.Service
	calendarID string
}

// NewServiceAccountClient 使用 JSON 金鑰檔案初始化
func NewServiceAccountClient(ctx context.Context, jsonPath string, calendarID string) (*GoogleCalendarService, error) {
	// 直接讀取 Service Account JSON
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read service account file: %v", err)
	}

	// 初始化服務，這裡不需要處理瀏覽器跳轉
	srv, err := calendar.NewService(ctx, option.WithAuthCredentialsJSON(option.ServiceAccount, data), option.WithScopes(calendar.CalendarEventsScope))
	if err != nil {
		return nil, fmt.Errorf("failed to create calendar service: %v", err)
	}

	return &GoogleCalendarService{
		srv:        srv,
		calendarID: calendarID,
	}, nil
}

// UpsertEvent 實作插入或更新
func (s *GoogleCalendarService) UpsertEvent(ctx context.Context, ev CalendarEvent) (string, error) {
	gEvent := &calendar.Event{
		Summary:     ev.Summary,
		Description: ev.Description,
		Start: &calendar.EventDateTime{
			Date: ev.Start,
		},
		End: &calendar.EventDateTime{
			Date: ev.End,
		},
	}

	var result *calendar.Event
	var err error

	if ev.ID != "" {
		// 使用 Patch 進行局部更新，這對通用服務來說最安全
		result, err = s.srv.Events.Patch(s.calendarID, ev.ID, gEvent).Context(ctx).Do()
	} else {
		// 建立新事件
		result, err = s.srv.Events.Insert(s.calendarID, gEvent).Context(ctx).Do()
	}

	if err != nil {
		return "", fmt.Errorf("google calendar api error: %v", err)
	}

	return result.Id, nil
}

// DeleteEvent 刪除事件
func (s *GoogleCalendarService) DeleteEvent(ctx context.Context, eventID string) error {
	if eventID == "" {
		return nil
	}
	return s.srv.Events.Delete(s.calendarID, eventID).Context(ctx).Do()
}
