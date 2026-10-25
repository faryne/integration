package google

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"time"

	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"
)

// eventKeyProperty 寫在事件 private extended property 的識別鍵，讓呼叫端能用自己的 ID 找回事件
const eventKeyProperty = "key"

// TimedEvent 有開始與結束時間的事件；Key 是呼叫端自己的識別（例如影片 ID），會寫進事件方便查回
type TimedEvent struct {
	Key         string
	Summary     string
	Description string
	Start, End  time.Time
}

// CalendarClient 以 service account 操作 Google Calendar；行事曆由 service account 自己建立並擁有
type CalendarClient struct {
	srv *calendar.Service
}

// NewCalendarClient 用 service account JSON 初始化；建立行事曆需要完整的 calendar scope
func NewCalendarClient(ctx context.Context, credentialsJSON []byte) (*CalendarClient, error) {
	srv, err := calendar.NewService(ctx, option.WithAuthCredentialsJSON(option.ServiceAccount, credentialsJSON), option.WithScopes(calendar.CalendarScope))
	if err != nil {
		return nil, fmt.Errorf("create calendar service: %w", err)
	}
	return &CalendarClient{srv: srv}, nil
}

// CreatePublicCalendar 建立行事曆並設成任何人可檢視，回傳行事曆 ID
func (c *CalendarClient) CreatePublicCalendar(ctx context.Context, summary, timeZone string) (string, error) {
	cal, err := c.srv.Calendars.Insert(&calendar.Calendar{Summary: summary, TimeZone: timeZone}).Context(ctx).Do()
	if err != nil {
		return "", err
	}
	rule := &calendar.AclRule{Role: "reader", Scope: &calendar.AclRuleScope{Type: "default"}}
	if _, err := c.srv.Acl.Insert(cal.Id, rule).Context(ctx).Do(); err != nil {
		return "", fmt.Errorf("make calendar %s public: %w", cal.Id, err)
	}
	return cal.Id, nil
}

// RenameCalendar 改行事曆名稱
func (c *CalendarClient) RenameCalendar(ctx context.Context, calendarID, summary string) error {
	_, err := c.srv.Calendars.Patch(calendarID, &calendar.Calendar{Summary: summary}).Context(ctx).Do()
	return err
}

// InsertEvent 建立事件，回傳事件 ID
func (c *CalendarClient) InsertEvent(ctx context.Context, calendarID string, ev TimedEvent) (string, error) {
	result, err := c.srv.Events.Insert(calendarID, toCalendarEvent(ev)).Context(ctx).Do()
	if err != nil {
		return "", err
	}
	return result.Id, nil
}

// PatchEvent 更新事件的標題、說明與時間
func (c *CalendarClient) PatchEvent(ctx context.Context, calendarID, eventID string, ev TimedEvent) error {
	_, err := c.srv.Events.Patch(calendarID, eventID, toCalendarEvent(ev)).Context(ctx).Do()
	return err
}

// DeleteEvent 刪除事件
func (c *CalendarClient) DeleteEvent(ctx context.Context, calendarID, eventID string) error {
	return c.srv.Events.Delete(calendarID, eventID).Context(ctx).Do()
}

// FindEventByKey 在時間範圍內找 Key 相同的事件，找不到回空字串
func (c *CalendarClient) FindEventByKey(ctx context.Context, calendarID, key string, from, to time.Time) (string, error) {
	result, err := c.srv.Events.List(calendarID).
		PrivateExtendedProperty(eventKeyProperty + "=" + key).
		TimeMin(from.Format(time.RFC3339)).TimeMax(to.Format(time.RFC3339)).
		SingleEvents(true).MaxResults(1).Context(ctx).Do()
	if err != nil || len(result.Items) == 0 {
		return "", err
	}
	return result.Items[0].Id, nil
}

func toCalendarEvent(ev TimedEvent) *calendar.Event {
	return &calendar.Event{
		Summary:     ev.Summary,
		Description: ev.Description,
		Start:       &calendar.EventDateTime{DateTime: ev.Start.Format(time.RFC3339)},
		End:         &calendar.EventDateTime{DateTime: ev.End.Format(time.RFC3339)},
		ExtendedProperties: &calendar.EventExtendedProperties{
			Private: map[string]string{eventKeyProperty: ev.Key},
		},
	}
}

// IsNotFound 事件或行事曆已經不存在（被手動刪除時回 404／410）
func IsNotFound(err error) bool {
	var apiErr *googleapi.Error
	return errors.As(err, &apiErr) && (apiErr.Code == http.StatusNotFound || apiErr.Code == http.StatusGone)
}

// IsQuotaExceeded Google API（例如 YouTube Data API）當天配額用完：403 帶 quotaExceeded／dailyLimitExceeded
func IsQuotaExceeded(err error) bool {
	var apiErr *googleapi.Error
	return errors.As(err, &apiErr) && apiErr.Code == http.StatusForbidden &&
		slices.ContainsFunc(apiErr.Errors, func(e googleapi.ErrorItem) bool {
			return e.Reason == "quotaExceeded" || e.Reason == "dailyLimitExceeded"
		})
}

// rateLimitReasons Calendar API 限流時 403 會帶的 reason
var rateLimitReasons = []string{"rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded", "usageLimits"}

// IsRateLimited 撞到 Calendar API 頻率或用量限制，呼叫端應該停下來等下一輪
func IsRateLimited(err error) bool {
	var apiErr *googleapi.Error
	if !errors.As(err, &apiErr) {
		return false
	}
	if apiErr.Code == http.StatusTooManyRequests {
		return true
	}
	return apiErr.Code == http.StatusForbidden && slices.ContainsFunc(apiErr.Errors, func(e googleapi.ErrorItem) bool {
		return slices.Contains(rateLimitReasons, e.Reason)
	})
}
