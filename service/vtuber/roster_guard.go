package vtuber

import (
	"context"
	"fmt"
	"html"

	"go.uber.org/zap"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	"faryne.dev/service/log"
	"faryne.dev/service/telegram"
)

// unitChangeGuardRatio 期別或卒業標記有變動的人數超過在籍數的這個比例，視為官網改版爬錯。
// 真實世界一次最多是新一期出道 3～5 人、或一兩人畢業，79 人的 20% 是 15 人以上
const unitChangeGuardRatio = 0.2

// unitGuardReason 判斷這次爬到的期別與卒業標記能不能信任；不能信任時回傳原因（log 與 TG 通知用），可以信任回空字串。
// active 是 DB 裡目前在籍的 hololive 頻道；新加入的頻道沒得比，不算變動
func unitGuardReason(rows, active []vtuberEntity.Channel, unitsFound bool) string {
	if !unitsFound {
		return "官網列表頁一個分組都沒抓到"
	}
	byID := make(map[string]vtuberEntity.Channel, len(active))
	for _, c := range active {
		byID[c.ChannelID] = c
	}
	var changed, emptied int
	for _, r := range rows {
		old, ok := byID[r.ChannelID]
		if !ok {
			continue
		}
		oldUnit, newUnit := deref(old.UnitSlug), deref(r.UnitSlug)
		// 藝人不會從某一期「消失」，畢業也只是多一個標記；原本有期別這次卻沒抓到，通常是某個分組頁爬壞了
		if oldUnit != "" && newUnit == "" {
			emptied++
		}
		if oldUnit != newUnit || old.IsGraduated != r.IsGraduated {
			changed++
		}
	}
	switch {
	case emptied > 0:
		return fmt.Sprintf("%d 位原本有期別的藝人這次沒抓到期別", emptied)
	case float64(changed) > float64(len(active))*unitChangeGuardRatio:
		return fmt.Sprintf("%d／%d 位藝人的期別或卒業標記有變動（門檻 %.0f%%）", changed, len(active), unitChangeGuardRatio*100)
	}
	return ""
}

// alertRosterGuard 名冊保護擋下寫入時記 warn 並發 TG，官網改版當天就會知道，不用等畫面壞掉才發現
func alertRosterGuard(ctx context.Context, reason, action string) {
	log.Logger().Warn("Hololive roster guard triggered", zap.String("reason", reason), zap.String("action", action))
	msg := "<b>hololive 名冊保護觸發</b>\n\n" + html.EscapeString(reason) + "\n" + html.EscapeString(action) +
		"\n\n官網可能改版了，修好爬蟲後手動跑 -cmd vtuber-hololive-talents"
	if err := telegram.SendMessage(ctx, msg); err != nil {
		log.Logger().Error("Hololive roster guard alert failed", zap.Error(err))
	}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
