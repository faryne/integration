package av

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"faryne.dev/config"
	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	authService "faryne.dev/service/auth"
)

var (
	// ErrVideoTargetNotFound 修改單指定的影片不存在（或 ES 已經找不到這部）
	ErrVideoTargetNotFound = errors.New("找不到要修改的影片")
	// ErrVideoTargetAmbiguous MCP 用官方番號指定時對到多部影片，要改用內部番號
	ErrVideoTargetAmbiguous = errors.New("有多部影片符合，請改用內部番號指定")
)

// SubmitVideo 建立一張待審核的影片修改單。present 不為 nil 時只採用這些欄位、其他沿用目前資料（MCP 只傳要改的欄位）。
// 目前資料一律從 ES 讀：logstash 時代的舊片只有 ES 是完整的
func SubmitVideo(ctx context.Context, req avEntity.VideoSubmitRequest, present []string, channel string, userID uint64, ip string) (*avEntity.VideoSubmitResult, error) {
	vid, src, err := resolveVideoTarget(ctx, req)
	if err != nil {
		return nil, err
	}
	base := videoFieldsFromSource(src)
	fields := req.Fields
	if present != nil {
		fields = applyVideoFields(base, req.Fields, present)
	}
	payload, err := normalizeVideoFields(fields)
	if err != nil {
		return nil, err
	}
	changed := changedVideoFields(base, payload)
	if len(changed) == 0 {
		return nil, ErrActressNoChanges
	}
	newValues, err := videoNewValues(ctx, base, payload)
	if err != nil {
		return nil, err
	}
	// DMM 的類型是固定清單，自己打的新標籤只會變成雜訊
	if tags := newValues["tags"]; len(tags) > 0 {
		return nil, invalidActress("標籤只能從現有的選項選：%s", strings.Join(tags, "、"))
	}
	if err := acquireAVSubmit(ip); err != nil {
		return nil, err
	}

	rawPayload, _ := json.Marshal(payload)
	rawBase, _ := json.Marshal(base)
	now := time.Now()
	sub := avEntity.DMMVideoSubmission{
		TargetVid: vid, TargetNo: sourceString(src["no"]),
		Payload: string(rawPayload), BaseSnapshot: string(rawBase), ChangedFields: strings.Join(changed, ","),
		Channel: channel, SubmitterIPHash: hashIP(ip), Status: avEntity.SubmissionStatusPending,
		CreatedAt: now, UpdatedAt: now,
	}
	if userID > 0 {
		sub.SubmitterUserID = &userID
	}
	if err := avRepo.NewDMMVideoSubmission().Create(&sub); err != nil {
		return nil, err
	}
	return &avEntity.VideoSubmitResult{ID: sub.ID, Status: sub.Status, ChangedFields: changed, NewValues: newValues}, nil
}

// resolveVideoTarget 找出要修改的影片：網頁傳詳細頁的內部番號（TargetNo，一定要完全相符）；
// MCP 傳官方番號或內部番號（Target），內部番號相符優先，官方番號對到多部時要求改用內部番號
func resolveVideoTarget(ctx context.Context, req avEntity.VideoSubmitRequest) (int, map[string]any, error) {
	target, exact := strings.TrimSpace(req.TargetNo), true
	if target == "" {
		target, exact = strings.TrimSpace(req.Target), false
	}
	if target == "" {
		return 0, nil, ErrVideoTargetNotFound
	}
	r, _, err := VideoSearch(avEntity.VideoQueryRequest{No: target, Page: 1})
	if err != nil {
		return 0, nil, err
	}
	var byNo, all []int
	nos := map[int]string{}
	for _, hit := range r.Hits.Hits {
		vid, err := strconv.Atoi(hit.Id)
		if err != nil || slices.Contains(all, vid) {
			continue
		}
		all, nos[vid] = append(all, vid), hit.Source.No
		if strings.EqualFold(hit.Source.No, target) {
			byNo = append(byNo, vid)
		}
	}
	var vid int
	switch {
	case len(byNo) > 0:
		vid = byNo[0]
	case exact || len(all) == 0:
		return 0, nil, ErrVideoTargetNotFound
	case len(all) == 1:
		vid = all[0]
	default:
		list := make([]string, 0, len(all))
		for _, v := range all {
			list = append(list, nos[v])
		}
		return 0, nil, fmt.Errorf("%w：%s", ErrVideoTargetAmbiguous, strings.Join(list, "、"))
	}
	srcs, err := getVideoSources(ctx, []int{vid})
	if err != nil {
		return 0, nil, err
	}
	src, ok := srcs[vid]
	if !ok {
		return 0, nil, ErrVideoTargetNotFound
	}
	return vid, src, nil
}

// videoNewValues 提交新加的值裡，整個影片庫一部都沒有的（欄位 → 值）；只查有新加值的欄位
func videoNewValues(ctx context.Context, before, after avEntity.VideoFields) (map[string][]string, error) {
	out := map[string][]string{}
	for field, added := range addedTerms(before, after) {
		var res struct {
			Aggregations struct {
				Values struct {
					Buckets []struct {
						Key string `json:"key"`
					} `json:"buckets"`
				} `json:"values"`
			} `json:"aggregations"`
		}
		key := field + ".keyword"
		body := map[string]any{
			"size":  0,
			"query": map[string]any{"terms": map[string]any{key: added}},
			"aggs":  map[string]any{"values": map[string]any{"terms": map[string]any{"field": key, "include": added, "size": len(added)}}},
		}
		if err := esSearch(ctx, config.EnvConfig().DMMVideoIndex, body, &res); err != nil {
			return nil, err
		}
		existing := map[string]bool{}
		for _, b := range res.Aggregations.Values.Buckets {
			existing[b.Key] = true
		}
		for _, v := range added {
			if !existing[v] {
				out[field] = append(out[field], v)
			}
		}
	}
	return out, nil
}

// sameNameActresses 新加的出演裡，名字（去掉括號別名）對到兩位以上女優的：沒有 DMM 女優 ID，分不出是哪一位
func sameNameActresses(before, after avEntity.VideoFields) ([]string, error) {
	added := addedTerms(before, after)["actresses"]
	if len(added) == 0 {
		return []string{}, nil
	}
	bases := make([]string, 0, len(added))
	for _, name := range added {
		bases = append(bases, actressBaseName(name))
	}
	rows, err := avRepo.NewDMMActress().FindByNames(actressSearchDomains, bases)
	if err != nil {
		return nil, err
	}
	out := []string{}
	for i, name := range added {
		// MySQL collation 不分平假名／片假名，這裡再比一次完全相同的名字
		n := 0
		for _, row := range rows {
			if row.Name == bases[i] {
				n++
			}
		}
		if n > 1 {
			out = append(out, name)
		}
	}
	return out, nil
}

// makerNoTaken 這個官方番號已經被別部影片使用（DMM 本來就有少數重複，只提醒不擋）
func makerNoTaken(vid int, makerNo string) ([]avEntity.VideoRef, error) {
	out := []avEntity.VideoRef{}
	if makerNo == "" {
		return out, nil
	}
	r, _, err := VideoSearch(avEntity.VideoQueryRequest{No: makerNo, Page: 1})
	if err != nil {
		return nil, err
	}
	for _, hit := range r.Hits.Hits {
		if id, _ := strconv.Atoi(hit.Id); id != vid && strings.EqualFold(hit.Source.MakerNo, makerNo) {
			out = append(out, avEntity.VideoRef{No: hit.Source.No, MakerNo: hit.Source.MakerNo, Title: hit.Source.Title})
		}
	}
	return out, nil
}

// VideoSubmissionStatusByID 給提交者查詢結果（不含提交者資訊）
func VideoSubmissionStatusByID(id uint64) (*avEntity.VideoSubmissionStatus, error) {
	sub, err := avRepo.NewDMMVideoSubmission().FindByID(id)
	if err != nil {
		return nil, err
	}
	status := &avEntity.VideoSubmissionStatus{
		ID: sub.ID, No: sub.TargetNo, Title: videoSubmissionPayload(*sub).Title, Status: sub.Status,
		CreatedAt: sub.CreatedAt, ReviewedAt: sub.ReviewedAt,
	}
	// 否決原因只在否決狀態給提交者看；改為核准後保留在 DB 供管理者追查
	if sub.Status == avEntity.SubmissionStatusRejected {
		status.ReviewNote = sub.ReviewNote
	}
	return status, nil
}

// ListVideoSubmissions 管理列表；未核准的單順便標出「提交後資料已變更」與「影片已經找不到」
func ListVideoSubmissions(ctx context.Context, userID uint64, req avEntity.VideoSubmissionListRequest) ([]avEntity.VideoSubmissionSummary, int64, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, 0, err
	}
	page, perPage := max(req.Page, 1), req.PerPage
	if perPage <= 0 {
		perPage = 30
	}
	rows, total, err := avRepo.NewDMMVideoSubmission().List(req.Status, page, perPage)
	if err != nil {
		return nil, 0, err
	}
	// 一次撈出相關的影片，避免逐列查詢
	var vids []int
	for _, sub := range rows {
		if sub.Status != avEntity.SubmissionStatusApproved {
			vids = append(vids, sub.TargetVid)
		}
	}
	srcs, err := getVideoSources(ctx, vids)
	if err != nil {
		return nil, 0, err
	}
	out := make([]avEntity.VideoSubmissionSummary, 0, len(rows))
	for _, sub := range rows {
		s := videoSubmissionSummary(sub)
		if sub.Status != avEntity.SubmissionStatusApproved {
			src, ok := srcs[sub.TargetVid]
			s.Missing = !ok
			s.Conflict = ok && len(changedVideoFields(videoSubmissionBase(sub), videoFieldsFromSource(src))) > 0
		}
		out = append(out, s)
	}
	return out, total, nil
}

// GetVideoSubmission 審核頁：提交內容、提交當下與現在的資料；未核准的單附上新值、官方番號重複、同名女優提醒
func GetVideoSubmission(ctx context.Context, userID, id uint64) (*avEntity.VideoSubmissionDetail, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, err
	}
	sub, err := avRepo.NewDMMVideoSubmission().FindByID(id)
	if err != nil {
		return nil, err
	}
	srcs, err := getVideoSources(ctx, []int{sub.TargetVid})
	if err != nil {
		return nil, err
	}
	detail := &avEntity.VideoSubmissionDetail{
		VideoSubmissionSummary: videoSubmissionSummary(*sub),
		Payload:                videoSubmissionPayload(*sub), Base: videoSubmissionBase(*sub),
		NewValues: map[string][]string{}, MakerNoTaken: []avEntity.VideoRef{}, SameNameActresses: []string{},
	}
	// 跟「目前資料」比；影片已經找不到時退回提交當下的資料
	left := detail.Base
	if src, ok := srcs[sub.TargetVid]; ok {
		current := videoFieldsFromSource(src)
		detail.Current, detail.Thumb, left = &current, sourceString(src["thumb"]), current
		detail.Conflict = len(changedVideoFields(detail.Base, current)) > 0
	} else {
		detail.Missing = true
	}
	if sub.Status == avEntity.SubmissionStatusApproved {
		return detail, nil
	}
	if detail.NewValues, err = videoNewValues(ctx, left, detail.Payload); err != nil {
		return nil, err
	}
	if detail.Payload.MakerNo != left.MakerNo {
		if detail.MakerNoTaken, err = makerNoTaken(sub.TargetVid, detail.Payload.MakerNo); err != nil {
			return nil, err
		}
	}
	if detail.SameNameActresses, err = sameNameActresses(left, detail.Payload); err != nil {
		return nil, err
	}
	return detail, nil
}

func videoSubmissionSummary(sub avEntity.DMMVideoSubmission) avEntity.VideoSubmissionSummary {
	changed := []string{}
	if sub.ChangedFields != "" {
		changed = strings.Split(sub.ChangedFields, ",")
	}
	// 番號用提交當下的值：修改單本身可能就是在改官方番號，列表顯示新值會看起來像另一部
	return avEntity.VideoSubmissionSummary{
		DMMVideoSubmission: sub, Title: videoSubmissionPayload(sub).Title, MakerNo: videoSubmissionBase(sub).MakerNo, ChangedFields: changed,
		IPHashPrefix: sub.SubmitterIPHash[:min(4, len(sub.SubmitterIPHash))],
	}
}

func videoSubmissionPayload(sub avEntity.DMMVideoSubmission) avEntity.VideoFields {
	return decodeVideoFields(sub.Payload)
}

func videoSubmissionBase(sub avEntity.DMMVideoSubmission) avEntity.VideoFields {
	return decodeVideoFields(sub.BaseSnapshot)
}

func decodeVideoFields(raw string) avEntity.VideoFields {
	m := map[string]any{}
	_ = json.Unmarshal([]byte(raw), &m)
	return videoFieldsFromMap(m)
}
