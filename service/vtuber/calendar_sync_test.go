package vtuber

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
)

func TestEventTimes(t *testing.T) {
	scheduled := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	actual := scheduled.Add(3 * time.Minute)
	ended := scheduled.Add(90 * time.Minute)

	start, end := eventTimes(vtuberEntity.Live{ScheduledStartAt: &scheduled})
	require.Equal(t, scheduled, start)
	require.Equal(t, scheduled.Add(2*time.Hour), end) // 還沒結束：抓 2 小時

	start, end = eventTimes(vtuberEntity.Live{ScheduledStartAt: &scheduled, ActualStartAt: &actual, ActualEndAt: &ended})
	require.Equal(t, actual, start)
	require.Equal(t, ended, end)
}

func TestPlanEvent(t *testing.T) {
	both := map[string]string{roleAll: "all@group", roleChannel: "ch@group"}
	want := eventRecord{Title: "[マリン] 歌枠", StartAt: "2026-10-23T12:00:00Z", EndAt: "2026-10-23T14:00:00Z", Status: vtuberEntity.LiveStatusUpcoming}
	synced := want
	synced.EventIDs = map[string]string{roleAll: "e1", roleChannel: "e2"}

	// 第一次看到：兩個行事曆都建
	require.Equal(t, eventPlan{Create: []string{roleAll, roleChannel}}, planEvent(want, nil, both))
	// 個人行事曆還沒建好：只建總表
	require.Equal(t, eventPlan{Create: []string{roleAll}}, planEvent(want, nil, map[string]string{roleAll: "all@group"}))
	// 沒變動：什麼都不做（upcoming → live 只改狀態，不算變動）
	liveNow := want
	liveNow.Status = vtuberEntity.LiveStatusLive
	require.True(t, planEvent(liveNow, &synced, both).empty())
	// 改時間：兩邊都更新
	moved := want
	moved.StartAt = "2026-10-23T13:00:00Z"
	require.Equal(t, eventPlan{Update: []string{roleAll, roleChannel}}, planEvent(moved, &synced, both))
	// 個人行事曆後來才建好：補建那一邊
	onlyAll := want
	onlyAll.EventIDs = map[string]string{roleAll: "e1"}
	require.Equal(t, eventPlan{Create: []string{roleChannel}}, planEvent(want, &onlyAll, both))

	// 取消：刪掉已建立的事件；已經刪過的不再處理；沒同步過的不用理
	cancelled := want
	cancelled.Status = vtuberEntity.LiveStatusCancelled
	plan := planEvent(cancelled, &synced, both)
	require.ElementsMatch(t, []string{roleAll, roleChannel}, plan.Delete)
	alreadyCancelled := cancelled
	require.True(t, planEvent(cancelled, &alreadyCancelled, both).empty())
	require.True(t, planEvent(cancelled, nil, both).empty())

	// 取消過又回來：重新建立
	require.Equal(t, eventPlan{Create: []string{roleAll, roleChannel}}, planEvent(want, &alreadyCancelled, both))
}

func TestKeepPrevious(t *testing.T) {
	next := eventRecord{Title: "new", StartAt: "s2", EndAt: "e2", Status: vtuberEntity.LiveStatusLive, EventIDs: map[string]string{roleAll: "e1"}}
	// 第一次同步就失敗：清空內容，下一輪一定會判定成有變動再試；已建立的事件 ID 保留
	got := keepPrevious(next, nil)
	require.Equal(t, eventRecord{Status: vtuberEntity.LiveStatusLive, EventIDs: map[string]string{roleAll: "e1"}}, got)

	prev := &eventRecord{Title: "old", StartAt: "s1", EndAt: "e1", Status: vtuberEntity.LiveStatusUpcoming}
	got = keepPrevious(next, prev)
	require.Equal(t, "old", got.Title)
	require.Equal(t, vtuberEntity.LiveStatusUpcoming, got.Status)
	require.Equal(t, "e1", got.EventIDs[roleAll])
}

func TestCalendarRows(t *testing.T) {
	rows, err := calendarRows(map[string]string{"all": "a@group.calendar.google.com", "UCCzUftO8KOVkV4wQG1vkUvg": " m@group.calendar.google.com "})
	require.NoError(t, err)
	require.ElementsMatch(t, []vtuberEntity.Calendar{
		{CalendarKey: "all", CalendarID: "a@group.calendar.google.com"},
		{CalendarKey: "UCCzUftO8KOVkV4wQG1vkUvg", CalendarID: "m@group.calendar.google.com"},
	}, rows)

	_, err = calendarRows(map[string]string{"propro": "x@group"})
	require.ErrorContains(t, err, "invalid calendar key")
	_, err = calendarRows(map[string]string{"all": ""})
	require.ErrorContains(t, err, "empty")
}
