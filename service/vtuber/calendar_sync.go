package vtuber

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	vtuberRepository "faryne.dev/repository/vtuber"
	googleService "faryne.dev/service/google"
	"faryne.dev/service/log"
)

// AllCalendarID hololive 總表（Apps Script 時代建的，舊 Firebase hololive/calendar/all）；前端 components/vtuber/calendar.ts 也寫死同一個
const AllCalendarID = "tisupenl6m3lnrjs26kipm1iu0@group.calendar.google.com"

const (
	syncPastWindow   = 24 * time.Hour
	syncFutureWindow = 14 * 24 * time.Hour
	// 每輪最多建幾個行事曆，避免撞到 Calendar API 建立行事曆的頻率限制
	maxCalendarCreatesPerRun = 5
	defaultEventDuration     = 2 * time.Hour
	calendarTimeZone         = "Asia/Taipei"
	channelCalendarName      = "Live Schedule of %s"
	firebaseEventsPath       = "vtuber/events"
	// Firebase 事件記錄保留天數，超過就由每日 job 清掉
	eventRecordRetention = 30 * 24 * time.Hour
)

// 事件在 Firebase 記錄裡的角色：總表／個人行事曆
const (
	roleAll     = "all"
	roleChannel = "channel"
)

// eventRecord Firebase vtuber/events/<videoId>：上次寫進行事曆的內容與事件 ID，用來判斷要不要更新
type eventRecord struct {
	ChannelID string            `json:"channelId"`
	Title     string            `json:"title"`
	StartAt   string            `json:"startAt"`
	EndAt     string            `json:"endAt"`
	Status    string            `json:"status"`
	EventIDs  map[string]string `json:"eventIds,omitempty"`
}

// eventPlan 一部直播在各角色行事曆上要做的事
type eventPlan struct {
	Create, Update, Delete []string
}

func (p eventPlan) empty() bool {
	return len(p.Create)+len(p.Update)+len(p.Delete) == 0
}

var (
	calendarOnce   sync.Once
	calendarClient *googleService.CalendarClient
	calendarErr    error
)

func newCalendarClient(ctx context.Context) (*googleService.CalendarClient, error) {
	calendarOnce.Do(func() {
		data, err := googleCredentials()
		if err != nil {
			calendarErr = err
			return
		}
		calendarClient, calendarErr = googleService.NewCalendarClient(context.Background(), data)
	})
	return calendarClient, calendarErr
}

var notConfiguredOnce sync.Once

// syncClients 取得 Calendar 與 Firebase client；沒設定時回 (nil, nil, nil) 讓呼叫端直接略過
func syncClients(ctx context.Context) (*googleService.CalendarClient, *firebaseDB, error) {
	cal, err := newCalendarClient(ctx)
	if err == nil {
		var fb *firebaseDB
		if fb, err = newFirebaseDB(); err == nil {
			return cal, fb, nil
		}
	}
	if errors.Is(err, errNotConfigured) {
		notConfiguredOnce.Do(func() { log.Logger().Warn("Vtuber calendar sync disabled: " + err.Error()) })
		return nil, nil, nil
	}
	return nil, nil, err
}

// SyncCalendars 比對 MySQL 的直播與 Firebase 上次同步的內容，把差異寫進 Google 行事曆
func SyncCalendars(ctx context.Context) error {
	cal, fb, err := syncClients(ctx)
	if err != nil || cal == nil {
		return err
	}
	channels, err := vtuberRepository.ListActiveChannels()
	if err != nil {
		return err
	}
	calendars, err := ensureCalendars(ctx, cal, channels)
	if err != nil {
		return err
	}

	now := time.Now()
	lives, err := vtuberRepository.FindLives(vtuberRepository.LiveFilter{From: now.Add(-syncPastWindow), To: now.Add(syncFutureWindow)})
	if err != nil {
		return err
	}
	var records map[string]eventRecord
	if err := fb.get(ctx, firebaseEventsPath, &records); err != nil {
		return err
	}
	byID := make(map[string]vtuberEntity.Channel, len(channels))
	for _, ch := range channels {
		byID[ch.ChannelID] = ch
	}

	for _, l := range lives {
		ch, ok := byID[l.ChannelID]
		if !ok {
			continue // 畢業的頻道不再同步
		}
		targets := map[string]string{roleAll: AllCalendarID}
		if id := calendars[ch.ChannelID]; id != "" {
			targets[roleChannel] = id
		}
		want := desiredRecord(l, ch)
		var current *eventRecord
		if rec, ok := records[l.VideoID]; ok {
			current = &rec
		}
		plan := planEvent(want, current, targets)
		if plan.empty() {
			continue
		}
		next, err := applyPlan(ctx, cal, l.VideoID, plan, want, current, targets)
		if err != nil {
			if googleService.IsRateLimited(err) {
				return fmt.Errorf("calendar api rate limited, retry next run: %w", err)
			}
			log.Logger().Warn("Sync vtuber live to calendar failed", zap.String("video_id", l.VideoID), zap.Error(err))
		}
		// 部分成功也要寫回，已建立的事件 ID 才不會遺失
		if err := fb.put(ctx, firebaseEventsPath+"/"+l.VideoID, next); err != nil {
			return err
		}
	}
	return nil
}

// desiredRecord 這部直播在行事曆上應該長怎樣
func desiredRecord(l vtuberEntity.Live, ch vtuberEntity.Channel) eventRecord {
	start, end := eventTimes(l)
	return eventRecord{
		ChannelID: l.ChannelID,
		Title:     "[" + ch.Title + "] " + l.Title,
		StartAt:   start.UTC().Format(time.RFC3339),
		EndAt:     end.UTC().Format(time.RFC3339),
		Status:    l.Status,
	}
}

// eventTimes 開始用實際開播時間（沒有就用預定時間）；結束用實際結束時間，沒有就抓開始後 2 小時
func eventTimes(l vtuberEntity.Live) (time.Time, time.Time) {
	var start time.Time
	if s := l.StartAt(); s != nil {
		start = *s
	}
	if l.ActualEndAt != nil {
		return start, *l.ActualEndAt
	}
	return start, start.Add(defaultEventDuration)
}

// planEvent 比對想要的內容與上次同步的記錄，決定各角色行事曆要建立、更新還是刪除
func planEvent(want eventRecord, current *eventRecord, targets map[string]string) eventPlan {
	var plan eventPlan
	if want.Status == vtuberEntity.LiveStatusCancelled {
		if current != nil && current.Status != vtuberEntity.LiveStatusCancelled {
			for role, id := range current.EventIDs {
				if id != "" {
					plan.Delete = append(plan.Delete, role)
				}
			}
		}
		return plan
	}
	// 之前被取消過（事件已刪）的直播又回來了，當成全新的處理
	revived := current != nil && current.Status == vtuberEntity.LiveStatusCancelled
	changed := current == nil || current.Title != want.Title || current.StartAt != want.StartAt || current.EndAt != want.EndAt
	for _, role := range []string{roleAll, roleChannel} {
		if targets[role] == "" {
			continue
		}
		switch {
		case current == nil || revived || current.EventIDs[role] == "":
			plan.Create = append(plan.Create, role)
		case changed:
			plan.Update = append(plan.Update, role)
		}
	}
	return plan
}

// applyPlan 依計畫呼叫 Calendar API，回傳要寫回 Firebase 的新記錄（失敗時回傳到失敗為止的進度）
func applyPlan(ctx context.Context, cal *googleService.CalendarClient, videoID string, plan eventPlan, want eventRecord, current *eventRecord, targets map[string]string) (eventRecord, error) {
	next := want
	next.EventIDs = map[string]string{}
	if current != nil && current.Status != vtuberEntity.LiveStatusCancelled {
		for role, id := range current.EventIDs {
			next.EventIDs[role] = id
		}
	}
	event := timedEvent(videoID, want)

	for _, role := range plan.Delete {
		if err := cal.DeleteEvent(ctx, targets[role], current.EventIDs[role]); err != nil && !googleService.IsNotFound(err) {
			return keepPrevious(next, current), err
		}
		delete(next.EventIDs, role)
	}
	for _, role := range plan.Update {
		err := cal.PatchEvent(ctx, targets[role], next.EventIDs[role], event)
		if googleService.IsNotFound(err) {
			// 事件被手動刪掉了，重建一個
			plan.Create = append(plan.Create, role)
			continue
		}
		if err != nil {
			return keepPrevious(next, current), err
		}
	}
	for _, role := range plan.Create {
		// 先找有沒有上一輪已經建好、但還沒寫進 Firebase 的事件
		id, err := cal.FindEventByKey(ctx, targets[role], videoID, event.Start.Add(-syncPastWindow), event.End.Add(syncPastWindow))
		if err == nil && id != "" {
			err = cal.PatchEvent(ctx, targets[role], id, event)
		} else if err == nil {
			id, err = cal.InsertEvent(ctx, targets[role], event)
		}
		if err != nil {
			return keepPrevious(next, current), err
		}
		next.EventIDs[role] = id
	}
	return next, nil
}

// keepPrevious 同步中途失敗時，標題／時間沿用上次的值，下一輪才會再判定成「有變動」重試
func keepPrevious(next eventRecord, current *eventRecord) eventRecord {
	if current == nil {
		next.Title, next.StartAt, next.EndAt = "", "", ""
		return next
	}
	next.Title, next.StartAt, next.EndAt, next.Status = current.Title, current.StartAt, current.EndAt, current.Status
	return next
}

func timedEvent(videoID string, rec eventRecord) googleService.TimedEvent {
	start, _ := time.Parse(time.RFC3339, rec.StartAt)
	end, _ := time.Parse(time.RFC3339, rec.EndAt)
	return googleService.TimedEvent{Key: videoID, Summary: rec.Title, Description: "https://youtu.be/" + videoID, Start: start, End: end}
}

// ensureCalendars 補建還沒有個人行事曆的頻道（每輪最多 5 個），回傳 channel ID → 行事曆 ID
func ensureCalendars(ctx context.Context, cal *googleService.CalendarClient, channels []vtuberEntity.Channel) (map[string]string, error) {
	calendars := make(map[string]string, len(channels))
	created := 0
	for _, ch := range channels {
		if id := ch.Calendar(); id != "" {
			calendars[ch.ChannelID] = id
			continue
		}
		if created >= maxCalendarCreatesPerRun {
			continue
		}
		id, err := cal.CreatePublicCalendar(ctx, fmt.Sprintf(channelCalendarName, ch.Title), calendarTimeZone)
		if err != nil {
			// 建不出來不擋事件同步，下一輪再試
			log.Logger().Warn("Create vtuber calendar failed", zap.String("channel_id", ch.ChannelID), zap.Error(err))
			created = maxCalendarCreatesPerRun
			continue
		}
		if _, err := vtuberRepository.SetChannelCalendars(map[string]string{ch.ChannelID: id}); err != nil {
			return nil, err
		}
		calendars[ch.ChannelID] = id
		created++
		log.Logger().Info("Vtuber calendar created", zap.String("channel_id", ch.ChannelID), zap.String("calendar_id", id))
	}
	return calendars, nil
}

// RenameChannelCalendars 頻道改名時，個人行事曆名稱跟著改（總表上的事件標題會在下一輪同步時自動更新）
func RenameChannelCalendars(ctx context.Context, renamed map[string]string) error {
	if len(renamed) == 0 {
		return nil
	}
	cal, _, err := syncClients(ctx)
	if err != nil || cal == nil {
		return err
	}
	channels, err := vtuberRepository.ListActiveChannels()
	if err != nil {
		return err
	}
	calendars := make(map[string]string, len(channels))
	for _, ch := range channels {
		calendars[ch.ChannelID] = ch.Calendar()
	}
	for channelID, title := range renamed {
		if id := calendars[channelID]; id != "" {
			if err := cal.RenameCalendar(ctx, id, fmt.Sprintf(channelCalendarName, title)); err != nil {
				log.Logger().Warn("Rename vtuber calendar failed", zap.String("channel_id", channelID), zap.Error(err))
			}
		}
	}
	return nil
}

// PruneCalendarEvents 清掉結束超過 30 天的 Firebase 事件記錄，讓每輪同步讀取的量維持在幾百筆
func PruneCalendarEvents(ctx context.Context) error {
	_, fb, err := syncClients(ctx)
	if err != nil || fb == nil {
		return err
	}
	var records map[string]eventRecord
	if err := fb.get(ctx, firebaseEventsPath, &records); err != nil {
		return err
	}
	cutoff := time.Now().Add(-eventRecordRetention)
	expired := map[string]any{}
	for id, rec := range records {
		if end, err := time.Parse(time.RFC3339, rec.EndAt); err == nil && end.Before(cutoff) {
			expired[id] = nil
		}
	}
	if len(expired) == 0 {
		return nil
	}
	return fb.patch(ctx, firebaseEventsPath, expired)
}
