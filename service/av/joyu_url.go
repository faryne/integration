package av

import (
	"net/url"
	"strconv"
	"strings"
)

// JoyuOrigin joyu.fyi 的對外網址：MCP 搜尋結果的連結、SEO canonical 共用
const JoyuOrigin = "https://joyu.fyi"

// JoyuVideoURL 影片頁網址：番號優先用 maker_no，沒有就用大寫的 no（跟前端 video_cover_card 的連結一致）
func JoyuVideoURL(makerNo, no string) string {
	code := makerNo
	if code == "" {
		code = strings.ToUpper(no)
	}
	return JoyuOrigin + "/video/" + url.PathEscape(code)
}

// JoyuActressURL 女優頁網址：帶這位自己的參數（手動上稿是 manual_id，其他是 xcity_id），
// 同名女優才不會開到別人；規則同前端 helpers/avActressRef.ts 的 actressPagePath
func JoyuActressURL(name, domain string, aid int) string {
	u := JoyuOrigin + "/actress/" + url.PathEscape(name)
	if aid <= 0 {
		return u
	}
	key := "xcity_id"
	if domain == "manual" {
		key = "manual_id"
	}
	return u + "?" + key + "=" + strconv.Itoa(aid)
}
