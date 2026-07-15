package fire_department

import (
	"fmt"
	"sync"
	"time"

	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"github.com/goccy/go-json"
	"go.uber.org/zap"
	"golang.org/x/sync/singleflight"
)

const realtimeEventsCacheKey = "opendata:fd:realtime_events"
const realtimeEventsByAreaCacheKeyPrefix = "opendata:fd:realtime_events:"
const realtimeEventsCacheTTL = 90 * time.Second

type realtimeEventFetcher struct {
	Area  string
	Fetch func() ([]Event, error)
}

var realtimeEventFetchers = []realtimeEventFetcher{
	{Area: "Taipei", Fetch: Taipei},
	{Area: "NewTaipei", Fetch: NewTaipei},
	{Area: "Taoyuan", Fetch: Taoyuan},
	{Area: "Taichung", Fetch: Taichung},
	{Area: "Tainan", Fetch: Tainan},
	{Area: "Kaohsiung", Fetch: Kaohsiung},
	{Area: "Keelung", Fetch: Keelung},
	{Area: "Ilan", Fetch: Ilan},
	{Area: "Yunlin", Fetch: Yunlin},
	{Area: "HsinchuCity", Fetch: HsinchuCity},
	{Area: "Miaoli", Fetch: Miaoli},
}

var realtimeEventsGroup singleflight.Group

var realtimeEventFetcherByArea = func() map[string]realtimeEventFetcher {
	fetchers := make(map[string]realtimeEventFetcher, len(realtimeEventFetchers))
	for _, fetcher := range realtimeEventFetchers {
		fetchers[fetcher.Area] = fetcher
	}

	return fetchers
}()

func RealtimeEvents() (map[string][]Event, error) {
	if events, ok := getCachedRealtimeEvents(); ok {
		return events, nil
	}

	result, err, _ := realtimeEventsGroup.Do(realtimeEventsCacheKey, func() (any, error) {
		if events, ok := getCachedRealtimeEvents(); ok {
			return events, nil
		}

		events, err := fetchRealtimeEvents()
		if err != nil {
			return nil, err
		}
		cacheRealtimeEvents(events)

		return events, nil
	})
	if err != nil {
		return nil, err
	}

	return result.(map[string][]Event), nil
}

func RealtimeEventsByArea(area string) ([]Event, error) {
	fetcher, ok := realtimeEventFetcherByArea[area]
	if !ok {
		return nil, fmt.Errorf("unsupported fire department realtime area %q", area)
	}

	cacheKey := realtimeEventsByAreaCacheKeyPrefix + area
	if events, ok := getCachedRealtimeEventsByArea(cacheKey); ok {
		return events, nil
	}

	result, err, _ := realtimeEventsGroup.Do(cacheKey, func() (any, error) {
		if events, ok := getCachedRealtimeEventsByArea(cacheKey); ok {
			return events, nil
		}

		events, err := fetcher.Fetch()
		if err != nil {
			return nil, err
		}
		cacheRealtimeEventsByArea(cacheKey, events)

		return events, nil
	})
	if err != nil {
		return nil, err
	}

	return result.([]Event), nil
}

func fetchRealtimeEvents() (map[string][]Event, error) {
	events := make(map[string][]Event, len(realtimeEventFetchers))
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, fetcher := range realtimeEventFetchers {
		wg.Add(1)
		go func(fetcher realtimeEventFetcher) {
			defer wg.Done()

			areaEvents, err := fetcher.Fetch()
			if err != nil {
				log.Logger().Warn(
					"Fetch realtime fire department events failed",
					zap.String("area", fetcher.Area),
					zap.Error(err),
				)
				return
			}

			mu.Lock()
			events[fetcher.Area] = areaEvents
			mu.Unlock()
		}(fetcher)
	}
	wg.Wait()

	return events, nil
}

func getCachedRealtimeEvents() (map[string][]Event, bool) {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return nil, false
	}

	raw, err := r.Get(realtimeEventsCacheKey).Result()
	if err != nil || raw == "" {
		return nil, false
	}

	var events map[string][]Event
	if err := json.Unmarshal([]byte(raw), &events); err != nil {
		_ = r.Del(realtimeEventsCacheKey).Err()
		return nil, false
	}

	return events, true
}

func cacheRealtimeEvents(events map[string][]Event) {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return
	}

	raw, err := json.Marshal(events)
	if err != nil {
		return
	}

	_ = r.Set(realtimeEventsCacheKey, string(raw), realtimeEventsCacheTTL).Err()
}

func getCachedRealtimeEventsByArea(cacheKey string) ([]Event, bool) {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return nil, false
	}

	raw, err := r.Get(cacheKey).Result()
	if err != nil || raw == "" {
		return nil, false
	}

	var events []Event
	if err := json.Unmarshal([]byte(raw), &events); err != nil {
		_ = r.Del(cacheKey).Err()
		return nil, false
	}

	return events, true
}

func cacheRealtimeEventsByArea(cacheKey string, events []Event) {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return
	}

	raw, err := json.Marshal(events)
	if err != nil {
		return
	}

	_ = r.Set(cacheKey, string(raw), realtimeEventsCacheTTL).Err()
}
