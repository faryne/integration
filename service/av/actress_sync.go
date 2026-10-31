package av

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/log"
	"faryne.dev/service/xcity"
	"go.uber.org/zap"
)

const actressDomainXCity = "xcity"
const actressPersistWorkers = 4
const actressPersistQueueSize = 100
const actressMaxPagesPerSyllabus = 100
const actressSyncTimeout = 24 * time.Hour

// actressIndexDocument ES 文件：domain＋aid 再攤平女優欄位（與 dmm_actresses.info 同格式）
type actressIndexDocument struct {
	Domain string `json:"domain"`
	AID    int    `json:"aid"`
	avEntity.ActressFields
}

type ActressSyncResult struct {
	Fetched int
	Saved   int
	Indexed int
	Skipped int
}

func SyncXCityActresses(ctx context.Context) (*ActressSyncResult, error) {
	result := &ActressSyncResult{}
	repo := avRepo.NewDMMActress()
	// 上稿核准過的手動修改：寫入前蓋回去，不然每次同步都會被 xcity 的值洗掉
	overrides, err := repo.OverridesByDomain(actressDomainXCity)
	if err != nil {
		return result, err
	}
	// 已存的別名（含每週從 DMM 名字補進來的）：跟 xcity 這次給的取聯集，不然每次同步都會被洗掉
	aliases, err := repo.AliasesByDomain(actressDomainXCity)
	if err != nil {
		return result, err
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	jobs := make(chan actressIndexDocument, actressPersistQueueSize)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstErr error
	seenIDs := make(map[int]struct{})

	addResult := func(update func()) {
		mu.Lock()
		defer mu.Unlock()
		update()
	}
	recordErr := func(err error) {
		if err == nil {
			return
		}
		mu.Lock()
		defer mu.Unlock()
		if firstErr == nil {
			firstErr = err
			cancel()
		}
	}

	for i := 0; i < actressPersistWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for doc := range jobs {
				if err := saveActress(repo, doc); err != nil {
					recordErr(err)
					continue
				}
				addResult(func() {
					result.Saved++
				})
				if err := indexActress(ctx, doc); err != nil {
					recordErr(err)
					continue
				}
				addResult(func() {
					result.Indexed++
				})
			}
		}()
	}

	finish := func() (*ActressSyncResult, error) {
		close(jobs)
		wg.Wait()

		mu.Lock()
		defer mu.Unlock()
		if firstErr != nil {
			return result, firstErr
		}
		return result, nil
	}

	for _, syllabus := range xcity.SyllabusKeys() {
		page := 1
		for {
			if page > actressMaxPagesPerSyllabus {
				log.Logger().Warn(
					"Stop XCity actress sync because page limit reached",
					zap.String("syllabus", syllabus),
					zap.Int("page_limit", actressMaxPagesPerSyllabus),
				)
				break
			}
			select {
			case <-ctx.Done():
				recordErr(ctx.Err())
				return finish()
			default:
			}

			actresses, err := xcity.ActressList(syllabus, page)
			if err != nil {
				recordErr(fmt.Errorf("fetch xcity actresses failed: syllabus=%s page=%d: %w", syllabus, page, err))
				return finish()
			}
			if len(actresses) == 0 {
				break
			}

			addResult(func() {
				result.Fetched += len(actresses)
			})
			newDocs := 0
			for _, actress := range actresses {
				doc, ok := buildActressIndexDocument(actress)
				doc.Aliases = mergeActressAliases(doc.Name, doc.Aliases, aliases[doc.AID])
				if raw, has := overrides[doc.AID]; ok && has {
					doc.ActressFields = withActressOverrides(doc.ActressFields, decodeActressOverrides(&raw))
				}
				if !ok {
					addResult(func() {
						result.Skipped++
					})
					continue
				}
				if _, exists := seenIDs[doc.AID]; exists {
					continue
				}
				seenIDs[doc.AID] = struct{}{}
				newDocs++
				select {
				case jobs <- doc:
				case <-ctx.Done():
					return finish()
				}
			}
			if newDocs == 0 {
				log.Logger().Warn(
					"Stop XCity actress sync because page returned no new IDs",
					zap.String("syllabus", syllabus),
					zap.Int("page", page),
				)
				break
			}

			page++
			time.Sleep(time.Second * 2)
		}
	}

	return finish()
}

func buildActressIndexDocument(actress xcity.Actress) (actressIndexDocument, bool) {
	name := strings.TrimSpace(actress.Name)
	if name == "" || actress.ID <= 0 {
		return actressIndexDocument{}, false
	}

	return actressIndexDocument{
		Domain: actressDomainXCity,
		AID:    actress.ID,
		ActressFields: avEntity.ActressFields{
			Name:       name,
			Aliases:    mergeActressAliases(name, actress.AliasName),
			Kana:       strings.TrimSpace(actress.Kana),
			Photo:      strings.TrimSpace(actress.Image),
			Height:     actress.Height,
			Bust:       actress.B,
			Waist:      actress.W,
			Hips:       actress.H,
			Cup:        strings.TrimSpace(actress.Cup),
			Blood:      strings.TrimSpace(actress.BloodType),
			BornCity:   strings.TrimSpace(actress.City),
			BirthYear:  actress.BirthYear,
			BirthMonth: actress.BirthMonth,
			BirthDay:   actress.BirthDay,
			Interests:  nonNil(actress.Interests),
			Links:      []avEntity.ActressLink{},
		},
	}, true
}

func saveActress(repo *avRepo.RepositoryDMMActress, doc actressIndexDocument) error {
	info, err := json.Marshal(doc.ActressFields)
	if err != nil {
		return err
	}

	now := time.Now()
	return repo.Upsert(avEntity.DMMActress{
		ID:        doc.AID,
		Domain:    doc.Domain,
		Name:      doc.Name,
		Info:      string(info),
		CreatedAt: now,
		UpdatedAt: now,
	})
}

// indexActress 本機（非 production 且用正式索引名）不寫 ES，避免動到 prod 共用的索引
func indexActress(ctx context.Context, doc actressIndexDocument) error {
	if !actressWritesAllowed() {
		return nil
	}
	return putActressDocument(ctx, doc, "true")
}

func SyncXCityActressesCron() {
	ctx, cancel := context.WithTimeout(context.Background(), actressSyncTimeout)
	defer cancel()

	startedAt := time.Now()
	result, err := SyncXCityActresses(ctx)
	if err != nil {
		log.Logger().Error("Sync XCity actresses failed", zap.Error(err))
		return
	}
	log.Logger().Info(
		"Sync XCity actresses finished",
		zap.Int("fetched", result.Fetched),
		zap.Int("saved", result.Saved),
		zap.Int("indexed", result.Indexed),
		zap.Int("skipped", result.Skipped),
		zap.Duration("elapsed", time.Since(startedAt)),
	)
}
