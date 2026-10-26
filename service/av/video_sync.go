package av

import (
	"bytes"
	"context"
	"encoding/json"
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
		n, err := persistVideos(ctx, repo, valid)
		result.Indexed += n
		if err != nil {
			return result, fmt.Errorf("persist page %d: %w", page, err)
		}
	}
	return result, nil
}

// persistVideos 先整頁 upsert 進 MySQL 取得 id，再逐筆寫 ES
func persistVideos(ctx context.Context, repo *avRepo.RepositoryDMMVideo, videos []dmm.DmmVideo) (int, error) {
	if len(videos) == 0 {
		return 0, nil
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
		if err := indexVideo(ctx, videoIndexDocument{DmmVideo: v, Vid: id}); err != nil {
			return indexed, err
		}
		indexed++
	}
	return indexed, nil
}

func indexVideo(ctx context.Context, doc videoIndexDocument) error {
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

// SyncDMMVideoByNo 詳細頁「同步資料」：用 DMM 內部番號單獨重抓一部作品，覆寫 MySQL＋ES（id 不變）。
// 主要用來幫缺官方番號（maker_no）的舊資料補齊，補完詳細頁才會出現 MissAV 連結
func SyncDMMVideoByNo(ctx context.Context, no string) (dmm.DmmVideo, error) {
	v, err := dmm.NewDMMClient().FetchVideo(no)
	if err != nil {
		return v, err
	}
	// 沒有配信日的明細一律不寫入，避免再出現 0001/01/01
	if v.VodDate == "" {
		return v, dmm.ErrVideoNotFound
	}
	_, err = persistVideos(ctx, avRepo.NewDMMVideo(), []dmm.DmmVideo{v})
	return v, err
}
