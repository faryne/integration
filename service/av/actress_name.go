package av

import (
	"slices"
	"strings"
)

// DMM 的女優名字常把別名寫在括號裡：「澤村レイコ（高坂保奈美、高坂ますみ）」。
// 大多是全形括號，少數是半形「七空うみ(七海そら)」、括號前多一個空白「みひな （…）」、
// 或全半形混用「江波りゅう（RYU)」；別名之間用「、」分隔。
// 女優頁、主題頁統計都靠下面這組規則把「名字」和「名字（別名…）」當成同一位。

// 「名字後面接哪些字串就是開始寫別名」的清單在 av.ActressAliasOpeners（影片索引查詢也要用）

// actressBaseName 去掉括號裡的別名，只留本名；沒有括號就原樣（去頭尾空白）回傳
func actressBaseName(name string) string {
	if i := strings.IndexAny(name, "（("); i >= 0 {
		name = name[:i]
	}
	return strings.TrimSpace(name)
}

// parseActressAlias 拆成本名與括號裡的別名（去重複、不含本名）；
// 「シェリー（Shelly、藤井シェリー）（しぇりー）」這種多組括號也一起拆
func parseActressAlias(name string) (string, []string) {
	base := actressBaseName(name)
	i := strings.IndexAny(name, "（(")
	if i < 0 {
		return base, nil
	}
	inner := strings.NewReplacer("（", "、", "(", "、", "）", "、", ")", "、").Replace(name[i:])
	return base, mergeActressAliases(base, strings.Split(inner, "、"))
}

// mergeActressAliases 把幾組別名併成一組：去頭尾空白、去掉空字串與本名、去重複，保留先出現的順序
func mergeActressAliases(name string, groups ...[]string) []string {
	out := []string{}
	for _, g := range groups {
		for _, a := range g {
			if a = strings.TrimSpace(a); a != "" && a != name && !slices.Contains(out, a) {
				out = append(out, a)
			}
		}
	}
	return out
}
