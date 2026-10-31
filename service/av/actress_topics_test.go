package av

import (
	"errors"
	"slices"
	"testing"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
)

func TestHoroscopeOf(t *testing.T) {
	for _, c := range []struct {
		month, day int
		want       string
	}{
		{3, 21, "aries"}, {4, 19, "aries"}, {4, 20, "taurus"},
		{12, 21, "sagittarius"}, {12, 22, "capricorn"}, {1, 19, "capricorn"}, {1, 20, "aquarius"},
		{2, 29, "pisces"},
		{11, 29, "sagittarius"}, {11, 30, ""}, // 11/30 是 xcity 的預設生日，不算星座
		{0, 0, ""}, {13, 1, ""},
	} {
		if got := horoscopeOf(c.month, c.day); got != c.want {
			t.Errorf("horoscopeOf(%d, %d) = %q, want %q", c.month, c.day, got, c.want)
		}
	}
}

func TestCupRank(t *testing.T) {
	for cup, want := range map[string]int{"": 0, "A": 1, "AA": 1, "AAA": 1, "AAAA": 0, "b": 2, "J": 10, "Z": 26, "B1": 0} {
		if got := cupRank(cup); got != want {
			t.Errorf("cupRank(%q) = %d, want %d", cup, got, want)
		}
	}
}

func TestMatchActressTopic(t *testing.T) {
	now := time.Date(2026, 11, 5, 4, 30, 0, 0, time.Local)
	p := actressTopicProfile{
		Fields:    avEntity.ActressFields{Name: "測試", Height: 150, Cup: "G", Waist: 57, Hips: 92, Blood: "A", BornCity: "東京都", BirthYear: 1995},
		Horoscope: "virgo",
		Stats:     actressVideoStats{Count: 40, First: "2026/03/01", Last: "2026/10/20"},
	}
	genres := genreCounts{"痴女": {"測試": 6}}
	for name, c := range map[string]struct {
		cond avEntity.ActressTopicConditions
		want bool
	}{
		"沒有條件":       {avEntity.ActressTopicConditions{}, true},
		"嬌小巨乳":       {avEntity.ActressTopicConditions{Height: [2]int{0, 152}, Cup: [2]string{"F", ""}}, true},
		"罩杯上限":       {avEntity.ActressTopicConditions{Cup: [2]string{"A", "D"}}, false},
		"臀腰差":        {avEntity.ActressTopicConditions{HipWaistDiff: [2]int{35, 0}}, true},
		"臀腰差不夠":      {avEntity.ActressTopicConditions{HipWaistDiff: [2]int{36, 0}}, false},
		"多個值是 OR":    {avEntity.ActressTopicConditions{Blood: []string{"B", "A"}, Horoscope: []string{"leo", "virgo"}}, true},
		"不同欄位是 AND":  {avEntity.ActressTopicConditions{Blood: []string{"A"}, BornCity: []string{"大阪府"}}, false},
		"東京痴女":       {avEntity.ActressTopicConditions{BornCity: []string{"東京都"}, Genres: []avEntity.ActressTopicGenreCondition{{Tag: "痴女", Min: 5}}}, true},
		"類型部數不夠":     {avEntity.ActressTopicConditions{Genres: []avEntity.ActressTopicGenreCondition{{Tag: "痴女", Min: 7}}}, false},
		"類型沒出現":      {avEntity.ActressTopicConditions{Genres: []avEntity.ActressTopicGenreCondition{{Tag: "熟女"}}}, false},
		"沒有資料的欄位不符合": {avEntity.ActressTopicConditions{Bust: [2]int{80, 0}}, false},
		"出道 12 個月內":  {avEntity.ActressTopicConditions{DebutWithinMonths: 12}, true},
		"出道 6 個月內":   {avEntity.ActressTopicConditions{DebutWithinMonths: 6}, false},
		"最近 1 個月有新作": {avEntity.ActressTopicConditions{ActiveWithinMonths: 1}, true},
		"出演數":        {avEntity.ActressTopicConditions{MinVideos: 41}, false},
		"出生年":        {avEntity.ActressTopicConditions{BirthYear: [2]int{1990, 1999}}, true},
	} {
		if got := matchActressTopic(p, c.cond, genres, now); got != c.want {
			t.Errorf("%s: got %v, want %v", name, got, c.want)
		}
	}
}

func TestTopicConditionSummary(t *testing.T) {
	for want, c := range map[string]avEntity.ActressTopicConditions{
		"F cup 以上・臀 90 以上":     {Cup: [2]string{"F", ""}, Hips: [2]int{90, 0}},
		"身高 152cm 以下・F cup 以上": {Height: [2]int{0, 152}, Cup: [2]string{"F", ""}},
		"A～B cup":              {Cup: [2]string{"A", "B"}},
		"處女座・A 型・痴女 3 部以上":     {Horoscope: []string{"virgo"}, Blood: []string{"A"}, Genres: []avEntity.ActressTopicGenreCondition{{Tag: "痴女", Min: 3}}},
		"1990～1999 年生・東京都":     {BirthYear: [2]int{1990, 1999}, BornCity: []string{"東京都"}},
		"臀腰差 32 以上":            {HipWaistDiff: [2]int{32, 0}},
		"出道 12 個月內・出演 50 部以上":  {DebutWithinMonths: 12, MinVideos: 50},
	} {
		if got := topicConditionSummary(c); got != want {
			t.Errorf("summary = %q, want %q", got, want)
		}
	}
}

func TestIsGenreTag(t *testing.T) {
	for tag, want := range map[string]bool{
		"熟女": true, "女子校生": true, "女捜査官": true,
		"ハイビジョン": false, "ベスト・総集編": false, "4K": false, "その他フェチ": false, "セット商品": false,
		"プラム他30％OFF": false, "春のパンツまつり30%OFF第2弾": false,
		"è¶…ä¹³": false, "": false,
	} {
		if got := isGenreTag(tag); got != want {
			t.Errorf("isGenreTag(%q) = %v, want %v", tag, got, want)
		}
	}
}

func TestPickGenreTopics(t *testing.T) {
	// 25 個標籤，部數由多到少：前 20 個是熱門；剩下 5 個裡 ≥1,000 部且人數夠的當冷門
	var tags []topicTagCount
	for i := range 25 {
		tags = append(tags, topicTagCount{Tag: string(rune('a' + i)), Count: 30000 - i*1000})
	}
	tags = append(tags, topicTagCount{Tag: "few-videos", Count: 999}, topicTagCount{Tag: "few-members", Count: 1500})
	members := func(tag string) (int, error) {
		if tag == "few-members" {
			return 19, nil
		}
		return 100, nil
	}
	hot, cold, err := pickGenreTopics(tags, members)
	if err != nil {
		t.Fatal(err)
	}
	if len(hot) != 20 || hot[0].Tag != "a" {
		t.Fatalf("hot = %v", hot)
	}
	// 冷門：u～y（5 個），排除部數不到 1,000 與人數不到 20 的，顯示時由多到少
	if len(cold) != 5 || cold[0].Tag != "u" || cold[4].Tag != "y" {
		t.Fatalf("cold = %v", cold)
	}
}

func TestGenreTopicFile(t *testing.T) {
	if a, b := genreTopicFile("熟女"), genreTopicFile("人妻・主婦"); a == b || len(a) != len("genre-12345678.json") {
		t.Fatalf("genreTopicFile = %q, %q", a, b)
	}
}

func TestNormalizeActressTopic(t *testing.T) {
	ok := avEntity.ActressTopicSaveRequest{
		Slug: " Tokyo-Chijo ", Title: " 東京痴女 ", GroupKey: "special", DefaultSort: "genre",
		Conditions: avEntity.ActressTopicConditions{
			BornCity: []string{"東京都", " 東京都 ", ""},
			Genres:   []avEntity.ActressTopicGenreCondition{{Tag: "痴女", Min: 5}, {Tag: "痴女"}, {Tag: " "}},
			Blood:    []string{"O", "A", "A"},
			Cup:      [2]string{"f", ""},
		},
	}
	got, err := normalizeActressTopic(ok)
	if err != nil {
		t.Fatal(err)
	}
	c := got.Conditions
	if got.Slug != "tokyo-chijo" || got.Title != "東京痴女" || len(c.BornCity) != 1 || len(c.Genres) != 1 || c.Genres[0].Min != 5 ||
		len(c.Blood) != 2 || c.Blood[0] != "A" || c.Cup[0] != "F" {
		t.Fatalf("unexpected normalize result: %+v", got)
	}

	bad := func(mut func(r *avEntity.ActressTopicSaveRequest)) avEntity.ActressTopicSaveRequest {
		r := ok
		r.Conditions.Genres = slices.Clone(ok.Conditions.Genres)
		mut(&r)
		return r
	}
	for name, r := range map[string]avEntity.ActressTopicSaveRequest{
		"沒有標題":       bad(func(r *avEntity.ActressTopicSaveRequest) { r.Title = " " }),
		"slug 有中文":   bad(func(r *avEntity.ActressTopicSaveRequest) { r.Slug = "東京" }),
		"撞到內建前綴":     bad(func(r *avEntity.ActressTopicSaveRequest) { r.Slug = "genre-x" }),
		"撞到管理頁":      bad(func(r *avEntity.ActressTopicSaveRequest) { r.Slug = "manage" }),
		"分組不合法":      bad(func(r *avEntity.ActressTopicSaveRequest) { r.GroupKey = "horoscope" }),
		"類型排序沒有類型條件": bad(func(r *avEntity.ActressTopicSaveRequest) { r.Conditions.Genres = nil }),
		"沒有任何條件": bad(func(r *avEntity.ActressTopicSaveRequest) {
			r.DefaultSort, r.Conditions = "videos", avEntity.ActressTopicConditions{}
		}),
		"區間顛倒":  bad(func(r *avEntity.ActressTopicSaveRequest) { r.Conditions.Height = [2]int{170, 150} }),
		"罩杯顛倒":  bad(func(r *avEntity.ActressTopicSaveRequest) { r.Conditions.Cup = [2]string{"H", "C"} }),
		"罩杯不合法": bad(func(r *avEntity.ActressTopicSaveRequest) { r.Conditions.Cup = [2]string{"B1", ""} }),
		"星座不合法": bad(func(r *avEntity.ActressTopicSaveRequest) { r.Conditions.Horoscope = []string{"ophiuchus"} }),
		"血型不合法": bad(func(r *avEntity.ActressTopicSaveRequest) { r.Conditions.Blood = []string{"C"} }),
	} {
		if _, err := normalizeActressTopic(r); !errors.Is(err, ErrActressTopicInvalid) {
			t.Errorf("%s: expected invalid, got %v", name, err)
		}
	}
}
