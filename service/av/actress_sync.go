package av

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"faryne.dev/service/xcity"
	"go.uber.org/zap"
)

const actressIndexName = "dmmactresses"
const actressDomainXCity = "xcity"
const actressPersistWorkers = 4
const actressPersistQueueSize = 100
const actressMaxPagesPerSyllabus = 100
const actressSyncTimeout = 24 * time.Hour

type actressIndexDocument struct {
	Domain     string   `json:"domain"`
	AID        int      `json:"aid"`
	Name       string   `json:"name"`
	Kana       string   `json:"kana"`
	Photo      string   `json:"photo,omitempty"`
	Height     int      `json:"height"`
	Bust       int      `json:"bust"`
	Waist      int      `json:"waist"`
	Hips       int      `json:"hips"`
	Cup        string   `json:"cup,omitempty"`
	Horoscope  string   `json:"horoscope,omitempty"`
	Blood      string   `json:"blood,omitempty"`
	BornCity   string   `json:"born_city,omitempty"`
	BirthYear  int      `json:"birth_year"`
	BirthMonth int      `json:"birth_month"`
	BirthDay   int      `json:"birth_day"`
	Interests  []string `json:"interests,omitempty"`
}

type actressInfoDocument struct {
	Name       string   `json:"name"`
	Kana       string   `json:"kana"`
	Photo      string   `json:"photo,omitempty"`
	Height     int      `json:"height"`
	Bust       int      `json:"bust"`
	Waist      int      `json:"waist"`
	Hips       int      `json:"hips"`
	Cup        string   `json:"cup,omitempty"`
	Horoscope  string   `json:"horoscope,omitempty"`
	Blood      string   `json:"blood,omitempty"`
	BornCity   string   `json:"born_city,omitempty"`
	BirthYear  int      `json:"birth_year"`
	BirthMonth int      `json:"birth_month"`
	BirthDay   int      `json:"birth_day"`
	Interests  []string `json:"interests,omitempty"`
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
		Domain:     actressDomainXCity,
		AID:        actress.ID,
		Name:       name,
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
		Interests:  actress.Interests,
	}, true
}

func saveActress(repo *avRepo.RepositoryDMMActress, doc actressIndexDocument) error {
	info, err := json.Marshal(actressInfoDocument{
		Name:       doc.Name,
		Kana:       doc.Kana,
		Photo:      doc.Photo,
		Height:     doc.Height,
		Bust:       doc.Bust,
		Waist:      doc.Waist,
		Hips:       doc.Hips,
		Cup:        doc.Cup,
		Horoscope:  doc.Horoscope,
		Blood:      doc.Blood,
		BornCity:   doc.BornCity,
		BirthYear:  doc.BirthYear,
		BirthMonth: doc.BirthMonth,
		BirthDay:   doc.BirthDay,
		Interests:  doc.Interests,
	})
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

func indexActress(ctx context.Context, doc actressIndexDocument) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}

	body, err := json.Marshal(doc)
	if err != nil {
		return err
	}

	resp, err := es.Index(
		actressIndexName,
		bytes.NewReader(body),
		es.Index.WithContext(ctx),
		es.Index.WithDocumentID(fmt.Sprintf("%s-%d", doc.Domain, doc.AID)),
		es.Index.WithRefresh("true"),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("index av actress failed: status=%s aid=%d name=%s", resp.Status(), doc.AID, doc.Name)
	}

	return nil
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
