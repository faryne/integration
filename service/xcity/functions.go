package xcity

import (
	"fmt"
	"github.com/PuerkitoBio/goquery"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type ActressSimple struct {
	Name string `json:"name"`
	Id   int    `json:"id"`
}

func ActressList(s string, page int) ([]Actress, error) {
	var allActresses = make([]Actress, 0)

	if page == 0 {
		page = 1
	}
	v, ok := syllabus[s]
	if !ok {
		return allActresses, fmt.Errorf("syllabus %s not found", s)
	}

	actressSimpleCollections, err := getActressListBySyllabusAndPage(v, page)
	if err != nil {
		return nil, err
	}

	for k, _actress := range actressSimpleCollections {
		actress, actressError := GetActressDetail(strconv.Itoa(_actress.Id))
		if actressError != nil {
			fmt.Println(actressError)
		} else {
			actress.ID = _actress.Id
			if actress.Name != "" {
				allActresses = append(allActresses, *actress)
			}
		}
		if k%5 == 0 {
			time.Sleep(time.Second * 2)
		}
	}

	return allActresses, nil
}

func getActressListBySyllabusAndPage(syllabus string, page int) ([]ActressSimple, error) {
	rows, err := getActressRequest(syllabus, page)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// getActressListBySyllabus 依假名全部撈出
func getActressListBySyllabus(syllabus string) []ActressSimple {
	out := make([]ActressSimple, 0)
	params := url.Values{}
	params.Add("kana", syllabus)
	params.Add("num", "90")
	page := 1
	for {
		targets, err := getActressRequest(syllabus, page)
		if err != nil {
			return nil
		}
		if len(targets) == 0 {
			break
		}
		out = append(out, targets...)
		time.Sleep(time.Second * 1)
		page++
	}
	return out
}

// getActressRequest fetches a list of actresses based on the given syllabus and page number from the specified baseUri.
// Parameters:
// - syllabus: A string representing the specific syllabus used for filtering actresses.
// - page: An integer specifying the page number of the results to retrieve.
// Returns:
// - A slice of ActressSimple containing the details of the actresses.
// - An error if the request or data processing fails.
func getActressRequest(syllabus string, page int) ([]ActressSimple, error) {
	out := make([]ActressSimple, 0)
	params := url.Values{}
	params.Add("kana", syllabus)
	params.Add("num", "90")
	params.Add("page", strconv.Itoa(page))
	uri := baseUri + "?" + params.Encode()
	resp, err := sendRequest(uri)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	q, _ := goquery.NewDocumentFromReader(resp.Body)
	targets := q.Find("div.itemBox > div.mid > p.name > a")
	l := targets.Length()

	if l > 0 {
		targets.Each(func(i int, s *goquery.Selection) {
			src := s.AttrOr("href", "")
			name := s.AttrOr("title", "")
			id := strings.TrimPrefix(src, "detail/")
			id = strings.TrimSuffix(id, "/")
			no, _ := strconv.Atoi(id)
			out = append(out, ActressSimple{
				Name: name,
				Id:   no,
			})
		})
	}
	return out, nil
}

type Actress struct {
	ID         int      `json:"id"`
	Image      string   `json:"image"`
	Name       string   `json:"name"`
	Kana       string   `json:"kana"`
	AliasName  []string `json:"alias_name"`
	BirthYear  int      `json:"birth_year"`
	BirthMonth int      `json:"birth_month"`
	BirthDay   int      `json:"birth_day"`
	BloodType  string   `json:"blood_type,omitempty"`
	B          int      `json:"b"`
	W          int      `json:"w"`
	H          int      `json:"h"`
	Cup        string   `json:"cup,omitempty"`
	Height     int      `json:"height,omitempty"`
	City       string   `json:"city,omitempty"`
	Interests  []string `json:"interests"`
}

func GetActressDetail(id string) (*Actress, error) {
	uri := baseUri + "detail/" + id
	fmt.Println(uri)
	resp, err := sendRequest(uri)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var actress = new(Actress)
	//var actressError error
	q, _ := goquery.NewDocumentFromReader(resp.Body)
	q.Find(".itemBox").Each(func(i int, s *goquery.Selection) {
		if i != 0 {
			return
		}
		actress, _ = matchActressDetail(s)
	})
	actress.ID, _ = strconv.Atoi(id)

	return actress, nil
}

func matchActressDetail(q *goquery.Selection) (*Actress, error) {
	out := new(Actress)
	q.Find("p.tn > img").Each(func(i int, s *goquery.Selection) {
		out.Image, _ = s.Attr("src")
	})
	// 處理名字
	q.Find("h1").Each(func(i int, s *goquery.Selection) {
		h1, _ := s.Html()
		getActressInfoFuncMappings["name"](h1, out)
	})
	// 處理三圍等個人資訊
	q.Find("dl.profile > dd").Each(func(i int, s *goquery.Selection) {
		ddHtml, _ := s.Html()
		if strings.Contains(ddHtml, "生年月日") {
			getActressInfoFuncMappings["birth"](ddHtml, out)
		} else if strings.Contains(ddHtml, "サイズ") {
			getActressInfoFuncMappings["3size"](ddHtml, out)
		} else if strings.Contains(ddHtml, "血液型") {
			getActressInfoFuncMappings["bloodType"](ddHtml, out)
		} else if strings.Contains(ddHtml, "身長") {
			getActressInfoFuncMappings["height"](ddHtml, out)
		} else if strings.Contains(ddHtml, "出身地") {
			getActressInfoFuncMappings["city"](ddHtml, out)
		} else if strings.Contains(ddHtml, "趣味") {
			getActressInfoFuncMappings["interests"](ddHtml, out)
		}
	})
	return out, nil
}

type getActressInfoFunc func(s string, o *Actress)

var getActressInfoFuncMappings = map[string]getActressInfoFunc{
	"name":      getName,
	"birth":     getBirthTime,
	"3size":     get3Size,
	"bloodType": getBloodType,
	"height":    getHeight,
	"city":      getBirthCity,
	"interests": getInterests,
}

func getName(s string, o *Actress) {
	pattern := `^([^\(\)]+)\(([^\)]+)\)(\[([^\]]+)\])?$`
	r := regexp.MustCompile(pattern)
	matched := r.FindStringSubmatch(s)
	if matched == nil {
		o.Name = strings.TrimSpace(s)
		return
	}
	o.Name = matched[1]
	if len(matched) >= 3 {
		o.Kana = matched[2]
	}
	if len(matched) >= 4 && matched[3] != "" {
		cleanText := strings.ReplaceAll(strings.Replace(matched[3], "[", "", -1), "]", "")
		aliasNames := strings.Split(cleanText, ",")
		o.AliasName = append(o.AliasName, aliasNames...)
	}
}

func getBirthTime(s string, o *Actress) {
	pattern := `([0-9]{4})年([0-9]{1,2})月([0-9]{1,2})日`
	r := regexp.MustCompile(pattern)
	matched := r.FindStringSubmatch(s)
	if matched != nil {
		o.BirthYear, _ = strconv.Atoi(matched[1])
		o.BirthMonth, _ = strconv.Atoi(matched[2])
		o.BirthDay, _ = strconv.Atoi(matched[3])
	}
}

func get3Size(s string, o *Actress) {
	//pattern := `B([0-9]{1,3})(?:\(([A-Z])(?:-(\d{1,3}))?\))?\s*W([0-9]{1,3})\s*H([0-9]{1,3})`
	pattern := `B([0-9]{1,3})(?:\(([A-Z])(?:-(\d{1,3}))?\))?\s*W([0-9]{1,3})\s*H([0-9]{1,3})`
	r := regexp.MustCompile(pattern)
	matched := r.FindStringSubmatch(s)
	fmt.Printf("%+v\n", matched)
	if matched != nil {
		if matched[1] != "" {
			o.B, _ = strconv.Atoi(matched[1])
		}
		if matched[2] != "" {
			o.Cup = matched[2]
		}
		if matched[4] != "" {
			o.W, _ = strconv.Atoi(matched[4])
		}
		if matched[5] != "" {
			o.H, _ = strconv.Atoi(matched[5])
		}
	}
}

func getBloodType(s string, o *Actress) {
	pattern := `([A-Z]+)型`
	r := regexp.MustCompile(pattern)
	matched := r.FindStringSubmatch(s)
	if matched != nil && matched[1] != "" {
		o.BloodType = matched[1]
	}
}

func getHeight(s string, o *Actress) {
	pattern := `([0-9]+)cm`
	r := regexp.MustCompile(pattern)
	matched := r.FindStringSubmatch(s)
	if matched != nil && matched[1] != "" {
		o.Height, _ = strconv.Atoi(matched[1])
	}
}

func getBirthCity(s string, o *Actress) {
	q, _ := goquery.NewDocumentFromReader(strings.NewReader(s))
	city := q.Text()
	if v := strings.Replace(city, "出身地", "", -1); v != "" {
		o.City = v
	}
}

func getInterests(s string, o *Actress) {
	q, _ := goquery.NewDocumentFromReader(strings.NewReader(s))
	cleanText := strings.TrimSpace(strings.Replace(q.Text(), "趣味", "", -1))
	if cleanText != "" {
		o.Interests = strings.Split(cleanText, ",")
	}
}
