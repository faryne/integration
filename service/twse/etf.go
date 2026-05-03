package twse

import (
	"encoding/json"
	"faryne.dev/service/helper"
	"github.com/shopspring/decimal"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type ResponseData struct {
	Stat   string   `json:"stat"`   // should be "OK"
	Fields []string `json:"fields"` // fileName
	Data   [][]any  `json:"data"`   // 依據類型不同會輸出不同欄位，需要在各自方法中處理
}

type ETF struct {
	Date    string `json:"date"` // 發行日，抓回來時要把「.」轉換為「-」
	Code    string `json:"code"`
	Name    string `json:"name"`
	Company string `json:"company"`
	Target  string `json:"target"`
}

type ETFDistribution struct {
	ExDate       string  `json:"ex_date"`
	PayableDate  string  `json:"payable_date"`
	Distribution float64 `json:"distribution"`
}

const (
	ETFCodeListUrl = "https://www.twse.com.tw/rwd/zh/ETF/list"   // 取得 ETF 名稱列表
	ETFShareUrl    = "https://www.twse.com.tw/rwd/zh/ETF/etfDiv" // 取得從 2005 年開始的配息
)

func GetCodeList() ([]ETF, error) {
	var out = make([]ETF, 0)
	r, err := sendRequest(http.MethodGet, ETFCodeListUrl, nil, nil)
	if err != nil {
		return out, err
	}
	for _, v := range r.Data {
		out = append(out, splitETFCodeData(v)...)
	}
	return out, nil
}

func splitETFCodeData(v []any) []ETF {
	target := ""
	if v[4] != nil {
		target = v[4].(string)
	}
	if !strings.Contains(v[0].(string), "<br>") {
		d := strings.ReplaceAll(v[0].(string), ".", "-")
		return []ETF{
			{
				Date:    d,
				Code:    v[1].(string),
				Name:    v[2].(string),
				Company: v[3].(string),
				Target:  target,
			},
		}
	}
	d := strings.Split(v[0].(string), "<br>")
	c := strings.Split(v[1].(string), "<br>")
	n := strings.Split(v[2].(string), "<br>")
	pattern := regexp.MustCompile(`([^0-9a-zA-Z.]+)`)
	out := make([]ETF, len(c))
	for k, _ := range c {
		dateData := strings.ReplaceAll(pattern.ReplaceAllString(d[k], ""), ".", "-")
		codeData := pattern.ReplaceAllString(c[k], "")
		out[k] = ETF{
			Date:    dateData,
			Code:    codeData,
			Name:    n[k],
			Company: v[3].(string),
			Target:  target,
		}
	}
	return out
}

func GetHistoryDivByCode(code string) ([]ETFDistribution, error) {
	var out = make([]ETFDistribution, 0)
	params := url.Values{}
	params.Add("stkNo", code)
	params.Add("startDate", "20050101")
	params.Add("endData", time.Now().Format("20060102"))
	r, err := sendRequest(http.MethodGet, ETFShareUrl, &params, nil)
	if err != nil {
		return out, err
	}
	for _, v := range r.Data {
		exDate, _ := helper.ROCFullDateToAD(v[2].(string), time.DateOnly)
		payableDate, _ := helper.ROCFullDateToAD(v[4].(string), time.DateOnly)
		distribution := float64(0)
		if v[5] != nil {
			d, _ := decimal.NewFromString(v[5].(string))
			distribution = d.InexactFloat64()
		}
		out = append(out, ETFDistribution{
			ExDate:       exDate,
			PayableDate:  payableDate,
			Distribution: distribution,
		})
	}
	return out, nil
}

func sendRequest(method, uri string, params, inputBody *url.Values) (*ResponseData, error) {
	// 處理 postBody
	var body io.Reader
	if method == http.MethodPost && inputBody != nil {
		body = strings.NewReader(inputBody.Encode())
	}
	u, err := url.Parse(uri)
	if err != nil {
		return nil, err
	}
	// 處理 uri querystring
	newParams := url.Values{}
	newParams.Add("response", "json")
	newParams.Add("_", strconv.FormatInt(time.Now().UnixNano(), 10))
	u.RawQuery = newParams.Encode()
	if params != nil {
		u.RawQuery += "&" + params.Encode()
	}
	// 準備 http request
	req, err := http.NewRequest(method, u.String(), body)
	if err != nil {
		return nil, err
	}
	// 發送
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	// 解析 body
	c, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var r ResponseData
	if jsonError := json.Unmarshal(c, &r); jsonError != nil {
		return nil, jsonError
	}
	return &r, nil
}
