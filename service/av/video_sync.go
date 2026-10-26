package av

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"faryne.dev/config"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/client"
	"faryne.dev/service/dmm"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// 正常一天 5~15 頁，設上限只是防 DMM 分頁異常時無窮迴圈
const videoSyncMaxPages = 100

// videoIndexDocument 寫進 ES dmmvideos 的文件：作品明細＋vid（dmm.id，同時是 document id，沿用 logstash 時代的規則）
type videoIndexDocument struct {
	dmm.DmmVideo
	Vid int `json:"vid"`
}

type VideoSyncResult struct {
	Fetched int // DMM 清單上的作品數
	Failed  int // 明細重試後仍抓不到，略過
	Skipped int // 明細沒有配信日，略過（避免再寫進 0001/01/01 這種資料）
	Indexed int // 寫入 MySQL＋ES 成功
}

// SyncDMMVideosByDate 抓指定配信日（YYYY-MM-DD）的全部作品，upsert 到 MySQL dmm 後直接寫 ES（覆蓋舊文件）。
// 取代原本 PHP dmm:daily-published＋logstash 的流程；logstash 只追新 id，舊作品更新不會進 ES。
func SyncDMMVideosByDate(ctx context.Context, date string) (VideoSyncResult, error) {
	var result VideoSyncResult
	dmmClient := dmm.NewDMMClient()
	repo := avRepo.NewDMMVideo()

	for page := 1; page <= videoSyncMaxPages; page++ {
		if err := ctx.Err(); err != nil {
			return result, err
		}
		videos, failed, err := dmmClient.SearchVideosByDaily(date, page)
		if err != nil {
			return result, fmt.Errorf("fetch page %d: %w", page, err)
		}
		if len(videos)+len(failed) == 0 {
			break
		}
		result.Fetched += len(videos) + len(failed)
		result.Failed += len(failed)

		valid := slices.DeleteFunc(slices.Clone(videos), func(v dmm.DmmVideo) bool { return v.VodDate == "" })
		result.Skipped += len(videos) - len(valid)
		n, err := persistVideos(ctx, repo, valid, false)
		result.Indexed += n
		if err != nil {
			return result, fmt.Errorf("persist page %d: %w", page, err)
		}
	}
	return result, nil
}

// ErrVideoWritesDisabled 非正式環境卻要寫正式的 dmmvideos：本機 DB 的 id 跟正式環境不同，寫進去會覆蓋別部作品
var ErrVideoWritesDisabled = errors.New("dmm video writes are disabled outside production unless DMM_VIDEO_INDEX points to a test index")

// videoWritesAllowed 本機與正式環境共用 ES cluster，只有正式環境、或明確把 DMM_VIDEO_INDEX 換成測試 index 時才允許寫入。
// 本機 go run 也會跑排程（凌晨的每日同步），沒有這道檢查就會用本機 id 覆寫正式資料
func videoWritesAllowed() bool {
	cfg := config.EnvConfig()
	return cfg.IsProduction() || cfg.DMMVideoIndex != "dmmvideos"
}

// persistVideos 先整頁 upsert 進 MySQL 取得 id，再逐筆寫 ES。
// waitVisible 為 true 時每筆都等 ES refresh 後才回傳（單筆同步要馬上查得到）；批次同步不等，避免拖慢
func persistVideos(ctx context.Context, repo *avRepo.RepositoryDMMVideo, videos []dmm.DmmVideo, waitVisible bool) (int, error) {
	if len(videos) == 0 {
		return 0, nil
	}
	if !videoWritesAllowed() {
		return 0, ErrVideoWritesDisabled
	}
	now := time.Now()
	rows := make([]avEntity.DMMVideo, 0, len(videos))
	nos := make([]string, 0, len(videos))
	for _, v := range videos {
		info, err := json.Marshal(v)
		if err != nil {
			return 0, err
		}
		// 欄位長度沿用 Laravel 建表時的限制，完整內容都在 info 裡，這裡截斷不影響 ES
		rows = append(rows, avEntity.DMMVideo{
			No:        strings.ToUpper(v.No),
			Title:     truncateRunes(v.Title, 255),
			Link:      truncateRunes("https://video.dmm.co.jp/av/content/?id="+v.No, 100),
			Thumb:     truncateRunes(v.Thumb, 100),
			Info:      string(info),
			CreatedAt: now,
			UpdatedAt: now,
		})
		nos = append(nos, strings.ToUpper(v.No))
	}
	if err := repo.UpsertBatch(rows); err != nil {
		return 0, err
	}
	ids, err := repo.IDsByNos(nos)
	if err != nil {
		return 0, err
	}

	indexed := 0
	for _, v := range videos {
		id, ok := ids[strings.ToUpper(v.No)]
		if !ok {
			return indexed, fmt.Errorf("dmm id not found after upsert: no=%s", v.No)
		}
		if err := indexVideo(ctx, videoIndexDocument{DmmVideo: v, Vid: id}, waitVisible); err != nil {
			return indexed, err
		}
		indexed++
	}
	return indexed, nil
}

func indexVideo(ctx context.Context, doc videoIndexDocument, waitVisible bool) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	body, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	resp, err := es.Index(
		config.EnvConfig().DMMVideoIndex,
		bytes.NewReader(body),
		es.Index.WithContext(ctx),
		es.Index.WithDocumentID(strconv.Itoa(doc.Vid)),
		es.Index.WithRefresh(refreshOption(waitVisible)),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("index dmm video failed: status=%s vid=%d no=%s", resp.Status(), doc.Vid, doc.No)
	}
	return nil
}

func truncateRunes(s string, n int) string {
	if r := []rune(s); len(r) > n {
		return string(r[:n])
	}
	return s
}

// SyncDMMVideoByNo 詳細頁「同步資料」：用 DMM 內部番號單獨重抓一部作品，覆寫 MySQL＋ES（id 不變），
// 並確認用官方番號已經查得到才回傳，前端收到成功就可以直接換到新網址。
// 確定失敗（DMM 已查無、沒有配信日、沒有官方番號）會把這部標成 orphan；暫時性錯誤不標，使用者之後可以再試
func SyncDMMVideoByNo(ctx context.Context, no string) (dmm.DmmVideo, error) {
	v, err := dmm.NewDMMClient().FetchVideo(no)
	// 沒有配信日的明細一律不寫入，避免再出現 0001/01/01
	if err == nil && v.VodDate == "" {
		err = dmm.ErrVideoNotFound
	}
	if errors.Is(err, dmm.ErrVideoNotFound) {
		markVideoOrphanOrLog(ctx, no)
		return v, err
	}
	if err != nil {
		return v, err
	}

	if _, err = persistVideos(ctx, avRepo.NewDMMVideo(), []dmm.DmmVideo{v}, true); err != nil {
		return v, err
	}
	// 資料是新的，但 DMM 沒給官方番號一樣出不了 MissAV 連結，視為確定失敗
	if v.MakerNo == "" {
		markVideoOrphanOrLog(ctx, v.No)
		return v, ErrVideoNoMakerNo
	}
	if !videoVisible(v.MakerNo) {
		return v, ErrVideoSyncNotVisible
	}
	return v, nil
}

// videoVisible 用官方番號查得到這部才算同步完成；ES 已經 refresh=wait_for，這裡是最後一道確認
func videoVisible(makerNo string) bool {
	_, rows, err := VideoSearch(avEntity.VideoQueryRequest{No: makerNo, Page: 1})
	return err == nil && len(rows) > 0
}

// markVideoOrphanOrLog 標 orphan 失敗不影響回給使用者的結果（同步本身已確定失敗），只記 log
func markVideoOrphanOrLog(ctx context.Context, no string) {
	if err := markVideoOrphan(ctx, no); err != nil {
		log.Logger().Error("Mark DMM video orphan failed: "+err.Error(), zap.String("no", no))
	}
}

// markVideoOrphan 依內部番號找出 ES 文件（vid＝dmm.id），把 MySQL 與 ES 都標成 orphan
func markVideoOrphan(ctx context.Context, no string) error {
	if !videoWritesAllowed() {
		return ErrVideoWritesDisabled
	}
	r, _, err := VideoSearch(avEntity.VideoQueryRequest{No: no, Page: 1})
	if err != nil || r == nil {
		return err
	}
	ids := make([]int, 0, len(r.Hits.Hits))
	for _, hit := range r.Hits.Hits {
		ids = append(ids, hit.Source.Vid)
	}
	if err := avRepo.NewDMMVideo().MarkOrphan(ids); err != nil {
		return err
	}
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	for _, hit := range r.Hits.Hits {
		resp, err := es.Update(
			config.EnvConfig().DMMVideoIndex,
			hit.Id,
			strings.NewReader(`{"doc":{"is_orphan":true}}`),
			es.Update.WithContext(ctx),
			es.Update.WithRefresh("wait_for"),
		)
		if err != nil {
			return err
		}
		resp.Body.Close()
		if resp.IsError() {
			return fmt.Errorf("mark dmm video orphan failed: status=%s id=%s", resp.Status(), hit.Id)
		}
	}
	return nil
}

func refreshOption(waitVisible bool) string {
	if waitVisible {
		return "wait_for"
	}
	return "false"
}
