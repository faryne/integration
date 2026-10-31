package av

import (
	"context"
	"encoding/json"
	"slices"
	"time"

	"faryne.dev/config"
	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/log"
	"faryne.dev/service/search"
	"go.uber.org/zap"
)

// actressAliasTermsSize 一次撈出所有帶括號的 DMM 名字（2026-10-31 約 440 個），留足空間
const actressAliasTermsSize = 10000

type ActressAliasSyncResult struct {
	Names   int // 帶括號的 DMM 名字
	Skipped int // 對不到、或對到不只一位女優而跳過的名字
	Updated int // 別名有變動、寫回的女優
}

// SyncDMMActressAliases 從 DMM 影片的「本名（別名、別名）」寫法補女優別名。
// 一組名字（本名＋別名）要剛好對到一位女優才補：優先看本名；本名對不到時，看別名裡是否剛好有一位 xcity／手動上稿的女優
// （xcity 有時用別名建檔，例如 DMM 寫「芦名未帆（稲森しほり）」、xcity 只有「稲森しほり」）。
// 同名女優分不出是哪一位，寧可不補；手動改過別名（overrides 有 aliases）的女優也不動
func SyncDMMActressAliases(ctx context.Context) (*ActressAliasSyncResult, error) {
	result := &ActressAliasSyncResult{}
	groups, err := dmmActressAliasGroups()
	if err != nil {
		return result, err
	}
	result.Names = len(groups)

	var names []string
	for _, g := range groups {
		names = append(names, g...)
	}
	repo := avRepo.NewDMMActress()
	rows, err := repo.FindByNames(actressSearchDomains, names)
	if err != nil {
		return result, err
	}
	// MySQL collation 不分平假名／片假名，這裡用完全相同的名字分組
	byName := map[string][]avEntity.DMMActress{}
	for _, row := range rows {
		byName[row.Name] = append(byName[row.Name], row)
	}

	// 先把每位女優要補的別名收齊（同一位可能出現在好幾種寫法裡），再一次寫回
	type pending struct {
		row     avEntity.DMMActress
		aliases []string
	}
	targets := map[avRepo.ActressKey]*pending{}
	for _, g := range groups {
		row, ok := pickAliasTarget(g, byName)
		if !ok {
			result.Skipped++
			continue
		}
		key := avRepo.ActressKey{Domain: row.Domain, ID: row.ID}
		if targets[key] == nil {
			targets[key] = &pending{row: row}
		}
		targets[key].aliases = append(targets[key].aliases, g...)
	}

	for _, t := range targets {
		if ctx.Err() != nil {
			return result, ctx.Err()
		}
		if _, manual := decodeActressOverrides(t.row.Overrides)["aliases"]; manual {
			continue
		}
		fields := actressRowFields(t.row)
		merged := mergeActressAliases(t.row.Name, fields.Aliases, t.aliases)
		if slices.Equal(merged, fields.Aliases) {
			continue
		}
		fields.Aliases = merged
		if err := saveActressFields(ctx, repo, t.row, fields); err != nil {
			return result, err
		}
		result.Updated++
	}
	return result, nil
}

// dmmActressAliasGroups 帶括號的 DMM 名字拆成「本名＋別名」；第一個是本名
func dmmActressAliasGroups() ([][]string, error) {
	q := map[string]any{
		"size": 0,
		"aggs": map[string]any{"names": map[string]any{"terms": map[string]any{
			"field": "actresses.keyword", "include": ".*[（(].*", "size": actressAliasTermsSize,
		}}},
	}
	r, _, err := search.Search[avEntity.RawVideo, avEntity.CleanVideo](config.EnvConfig().DMMVideoIndex, q)
	if err != nil {
		return nil, err
	}
	var groups [][]string
	for _, b := range r.Aggregations["names"].Buckets {
		if base, aliases := parseActressAlias(b.Key); base != "" && len(aliases) > 0 {
			groups = append(groups, append([]string{base}, aliases...))
		}
	}
	return groups, nil
}

// pickAliasTarget 這組名字要補給哪一位：本名剛好一位就是她；本名沒人時，別名裡剛好只有一位女優才算
func pickAliasTarget(group []string, byName map[string][]avEntity.DMMActress) (avEntity.DMMActress, bool) {
	if rows := byName[group[0]]; len(rows) > 0 {
		return rows[0], len(rows) == 1
	}
	var found []avEntity.DMMActress
	for _, name := range group[1:] {
		found = append(found, byName[name]...)
	}
	if len(found) != 1 {
		return avEntity.DMMActress{}, false
	}
	return found[0], true
}

// saveActressFields 寫回一位女優的 info，並更新 ES 文件（本機用正式索引名時不寫 ES）
func saveActressFields(ctx context.Context, repo *avRepo.RepositoryDMMActress, row avEntity.DMMActress, fields avEntity.ActressFields) error {
	info, err := json.Marshal(fields)
	if err != nil {
		return err
	}
	row.Info, row.UpdatedAt = string(info), time.Now()
	if err := repo.Upsert(row); err != nil {
		return err
	}
	if !actressWritesAllowed() {
		return nil
	}
	return putActressDocument(ctx, actressIndexDocument{Domain: row.Domain, AID: row.ID, ActressFields: fields}, "false")
}

func SyncDMMActressAliasesCron() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Hour)
	defer cancel()
	result, err := SyncDMMActressAliases(ctx)
	if err != nil {
		log.Logger().Error("Sync DMM actress aliases failed", zap.Error(err))
		return
	}
	log.Logger().Info(
		"Sync DMM actress aliases finished",
		zap.Int("names", result.Names),
		zap.Int("skipped", result.Skipped),
		zap.Int("updated", result.Updated),
	)
}
