package recaptcha

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"faryne.dev/config"
	"faryne.dev/service/log"

	"go.uber.org/zap"
)

// joyu.fyi 的 reCAPTCHA Enterprise 驗證：前端送出表單前用 site key 取得 token（兩分鐘內有效），
// 後端用 key 的 legacy secret 呼叫 siteverify，確認 token 有效、action 相符、分數夠高。
// （Enterprise key 開了 legacy secret 就能走 siteverify，不需要 Google Cloud 專案 ID 和 API key）
// secret 沒設時不驗證直接放行，本機開發與尚未設定的環境不會卡住。

// action 名稱要跟前端 grecaptcha.enterprise.execute 帶的一致（只能用英數與底線）
const (
	ActionActressSubmit = "ACTRESS_SUBMIT"
	ActionVideoSubmit   = "VIDEO_SUBMIT"
)

const siteverifyURL = "https://www.google.com/recaptcha/api/siteverify"

// ErrFailed token 缺少、無效、action 不符或分數太低
var ErrFailed = errors.New("recaptcha verification failed")

var (
	httpClient     = &http.Client{Timeout: 5 * time.Second}
	warnMissedOnce sync.Once
)

type siteverifyResult struct {
	Success    bool     `json:"success"`
	Score      float64  `json:"score"`
	Action     string   `json:"action"`
	Hostname   string   `json:"hostname"`
	ErrorCodes []string `json:"error-codes"`
}

// Verify 驗證 token。Google 那邊本身出錯（逾時、非 200）時放行並記 log：上稿另外有 IP 限流，
// 不要因為 Google 暫時有問題就讓所有人都送不出去
func Verify(ctx context.Context, token, action, ip string) error {
	cfg := config.EnvConfig()
	if cfg.JoyuRecaptchaSecret == "" {
		warnMissedOnce.Do(func() {
			log.Logger().Warn("recaptcha: JOYU_RECAPTCHA_SECRET 沒有設定，略過驗證")
		})
		return nil
	}
	if token == "" {
		return ErrFailed
	}
	form := url.Values{"secret": {cfg.JoyuRecaptchaSecret}, "response": {token}, "remoteip": {ip}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, siteverifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := httpClient.Do(req)
	if err != nil {
		log.Logger().Error("recaptcha: siteverify 呼叫失敗，放行", zap.Error(err))
		return nil
	}
	defer res.Body.Close()
	var r siteverifyResult
	if res.StatusCode != http.StatusOK || json.NewDecoder(res.Body).Decode(&r) != nil {
		log.Logger().Error("recaptcha: siteverify 回應異常，放行", zap.Int("status", res.StatusCode))
		return nil
	}
	if !r.Success || r.Action != action || r.Score < cfg.JoyuRecaptchaMinScore {
		log.Logger().Info("recaptcha: 驗證未通過",
			zap.String("action", action), zap.String("token_action", r.Action), zap.Strings("error_codes", r.ErrorCodes),
			zap.Float64("score", r.Score), zap.String("hostname", r.Hostname), zap.String("ip", ip))
		return ErrFailed
	}
	return nil
}
