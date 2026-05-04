package twse

import (
	"bytes"
	"context"
	"encoding/json"
	configInst "faryne.dev/config"
	"faryne.dev/service/helper"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/shopspring/decimal"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

type ResponseData struct {
	Stat   string   `json:"stat"`   // should be "OK"
	Fields []string `json:"fields"` // fileName
	Data   [][]any  `json:"data"`   // 依據類型不同會輸出不同欄位，需要在各自方法中處理
}

type ETF struct {
	Date    string `json:"date,omitempty"` // 發行日，抓回來時要把「.」轉換為「-」
	Code    string `json:"code"`
	Name    string `json:"name"`
	Company string `json:"company,omitempty"`
	Target  string `json:"target,omitempty"`
}

type ETFDistribution struct {
	ExDate       string  `json:"ex_date"`
	PayableDate  string  `json:"payable_date"`
	Distribution float64 `json:"distribution"`
}

type ETFDistributionWithCode struct {
	ETFDistribution
	ETF
}

const (
	ETFCodeListUrl = "https://www.twse.com.tw/rwd/zh/ETF/list"   // 取得 ETF 名稱列表
	ETFShareUrl    = "https://www.twse.com.tw/rwd/zh/ETF/etfDiv" // 取得從 2005 年開始的配息
	S3PrefixKey    = "opendata/twse/etf"
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
	r, err := sendRequest(http.MethodGet, ETFShareUrl, params, nil)
	if err != nil {
		return out, err
	}
	for _, v := range r.Data {
		exDate, exDateError := helper.ROCFullDateToAD(v[2].(string), time.DateOnly)
		if exDateError != nil {
			fmt.Printf("invalid exDate: %s, %s\n", v[2].(string), exDateError.Error())
			continue
		}
		payableDate, payableDateError := helper.ROCFullDateToAD(v[4].(string), time.DateOnly)
		if payableDateError != nil {
			fmt.Printf("invalid payableDate: %s, %s\n", v[4].(string), payableDateError.Error())
			continue
		}
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

func CronEtfCodeList() {
	codeList, codeListError := GetCodeList()
	if codeListError != nil {
		fmt.Println("codeListError: ", codeListError.Error())
		return
	}
	if err := writeFile(fmt.Sprintf(S3PrefixKey+"/code_list.json"), codeList); err != nil {
		fmt.Println("writeFile error: ", err.Error())
		return
	}

}

func CronETFData() {
	var codeList []ETF
	resp, err := http.DefaultClient.Get(configInst.EnvConfig().CDNUrl + "/" + S3PrefixKey + "/code_list.json")
	if err != nil {
		fmt.Println("err: ", err)
		return
	}
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(&codeList); err != nil {
		fmt.Println("err: ", err)
	}

	for _, v := range codeList {
		distributions, err := GetHistoryDivByCode(v.Code)
		if err != nil {
			fmt.Println("distribution error: ", err, " v: ", v, " distributions: ", distributions, "")
			continue
		}
		go writeFile(fmt.Sprintf(S3PrefixKey+"/by_stock/%s.json", v.Code), distributions)

		time.Sleep(time.Second * 2) // 休息 2 秒避免被 ban
	}
}

func CronETFUpcomingShareDaily() {
	var codeList []ETF
	resp, err := http.DefaultClient.Get(configInst.EnvConfig().CDNUrl + "/" + S3PrefixKey + "/code_list.json")
	if err != nil {
		fmt.Println("err: ", err)
		return
	}
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(&codeList); err != nil {
		fmt.Println("err: ", err)
	}

	// 以除權日為基礎
	distributionByDaily := make(map[string][]ETFDistributionWithCode)
	var mu sync.Mutex

	for _, v := range codeList {
		var distributions []ETFDistribution
		distResp, distRespError := http.DefaultClient.Get(configInst.EnvConfig().CDNUrl + "/" + S3PrefixKey + "/by_stock/" + v.Code + ".json")
		if distRespError != nil {
			continue
		}
		distContent, _ := io.ReadAll(distResp.Body)
		if jsonError := json.Unmarshal(distContent, &distributions); jsonError != nil {
			fmt.Println("err: ", jsonError)
			continue
		}
		distResp.Body.Close()

		// 先把取到的部分存進 by 個股的檔案中
		mu.Lock()
		for _, d := range distributions {
			if _, timeError := time.Parse("2006-01-02", d.ExDate); timeError != nil {
				fmt.Printf("invalid date: %s, %s, d: %v, v: %v\n", d.ExDate, timeError.Error(), d, v)
				continue
			}
			if _, ok := distributionByDaily[d.ExDate]; !ok {
				distributionByDaily[d.ExDate] = make([]ETFDistributionWithCode, 0)
			}
			distributionByDaily[d.ExDate] = append(distributionByDaily[d.ExDate], ETFDistributionWithCode{
				ETFDistribution: d,
				ETF:             v,
			})
		}
		mu.Unlock()
	}
	// 根據日期開始寫檔
	for k, v := range distributionByDaily {
		splitDate := strings.Split(k, "-")
		go writeFile(fmt.Sprintf(S3PrefixKey+"/by_daily/%s/%s/%s.json", splitDate[0], splitDate[1], k), v)
	}
	c, _ := json.MarshalIndent(distributionByDaily, "", "  ")

	fmt.Println(string(c))
}

func sendRequest(method, uri string, params, inputBody url.Values) (*ResponseData, error) {
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

func writeFile(fileName string, data any) error {
	c, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	ctx := context.TODO()

	// 使用靜態金鑰建立 Provider
	staticProvider := credentials.NewStaticCredentialsProvider(configInst.EnvConfig().S3AccessKey, configInst.EnvConfig().S3SecretKey, "")

	// 載入設定時強制指定 CredentialsProvider 和 Region
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(configInst.EnvConfig().S3Region),
		config.WithCredentialsProvider(staticProvider),
	)
	if err != nil {
		return fmt.Errorf("無法載入 AWS 設定: %v", err)
	}
	client := s3.NewFromConfig(cfg)

	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(configInst.EnvConfig().S3Bucket),
		Key:         aws.String(fileName),
		Body:        bytes.NewReader(c),
		ContentType: aws.String("application/json"),
	})

	return err
}
