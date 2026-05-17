package twse

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	configInst "faryne.dev/config"
	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	etfRepo "faryne.dev/repository/etf"
	"faryne.dev/service/helper"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/shopspring/decimal"
)

type OTCEtfResponse struct {
	MsgArray []struct {
		Ex  string `json:"ex"`
		Ch  string `json:"ch"`
		Nf  string `json:"nf"`
		Key string `json:"key"`
		N   string `json:"n"`
		Bp  string `json:"bp"`
	} `json:"msgArray"`
	Size      int    `json:"size"`
	Rtcode    string `json:"rtcode"`
	QueryTime struct {
		StockDetail    int `json:"stockDetail"`
		TotalMicroTime int `json:"totalMicroTime"`
	} `json:"queryTime"`
	Rtmessage   string `json:"rtmessage"`
	ExKey       string `json:"exKey"`
	CachedAlive int    `json:"cachedAlive"`
}

type ResponseData struct {
	Stat   string   `json:"stat"`   // should be "OK"
	Fields []string `json:"fields"` // fileName
	Data   [][]any  `json:"data"`   // 依據類型不同會輸出不同欄位，需要在各自方法中處理
}

type OTCETFDistribution struct {
	Amount      string `json:"amount"`
	StockName   string `json:"stockName"`
	DivDate     string `json:"divDate"`
	Year        string `json:"year"`
	InDate      string `json:"inDate"`
	Description string `json:"description"`
	InBaseDate  string `json:"inBaseDate"`
	StockNo     string `json:"stockNo"`
}

type FinMindHistoryTicker struct {
	Msg    string `json:"msg"`
	Status int    `json:"status"`
	Data   []struct {
		Date            string  `json:"date"`
		StockId         string  `json:"stock_id"`
		TradingVolume   int     `json:"Trading_Volume"`
		TradingMoney    int64   `json:"Trading_money"`
		Open            float64 `json:"open"`
		Max             float64 `json:"max"`
		Min             float64 `json:"min"`
		Close           float64 `json:"close"`
		Spread          float64 `json:"spread"`
		TradingTurnover int     `json:"Trading_turnover"`
	} `json:"data"`
}

const (
	ETFCodeListUrl    = "https://www.twse.com.tw/rwd/zh/ETF/list"           // 取得 ETF 名稱列表
	ETFShareUrl       = "https://www.twse.com.tw/rwd/zh/ETF/etfDiv"         // 取得從 2005 年開始的配息（證交所）
	ETFOtcShareUrl    = "https://info.tpex.org.tw/api/etfExDiv"             // 取得從 2005 年開始的配息（櫃買中心）
	OTCETFCodeListUrl = "https://mis.twse.com.tw/stock/api/getCategory.jsp" // 登記在櫃買中心的 ETF
	FinMindApiBase    = "https://api.finmindtrade.com/api/v4/data"          // FinMind API Base Path
	S3PrefixKey       = "opendata/twse/etf"

	// "https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=00400A&start_date=2026-05-01" // 股價資料
	// "https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDividend&data_id=0050&start_date=2001-01-01" // 股利政策
)

// getTWSEETFCodeList 取得證券交易所上市 ETF 資料
func getTWSEETFCodeList() ([]etf.ETF, error) {
	var out = make([]etf.ETF, 0)
	r, err := sendRequest[ResponseData](http.MethodGet, ETFCodeListUrl, nil, nil)
	if err != nil {
		return out, err
	}
	for _, v := range r.Data {
		out = append(out, splitETFCodeData(v)...)
	}
	return out, nil
}

// getOTCCodeList 取得櫃買中心上市 ETF 資料
func getOTCCodeList() ([]etf.ETF, error) {
	var out = make([]etf.ETF, 0)
	u := url.Values{}
	u.Add("ex", "otc") // tse / otc ?
	u.Add("i", "B0")
	u.Add("lang", "zh_tw")
	r, err := sendRequest[OTCEtfResponse](http.MethodGet, OTCETFCodeListUrl, u, nil)
	if err != nil {
		return out, err
	}
	for _, v := range r.MsgArray {
		out = append(out, etf.ETF{
			Code:    strings.Replace(v.Ch, ".tw", "", -1),
			Name:    v.N,
			Company: "",
			Market:  enum.StockMarketOTC,
		})
	}
	return out, nil
}

// UpdateETFCodeList 更新 ETF 資訊
func UpdateETFCodeList() ([]etf.ETF, error) {
	var out = make([]etf.ETF, 0)
	// 處理證交所的
	r, err := getTWSEETFCodeList()
	if err != nil {
		return nil, err
	}
	out = append(out, r...)
	// 處理櫃買中心的
	otcCodeList, err := getOTCCodeList()
	if err != nil {
		return nil, err
	}
	out = append(out, otcCodeList...)

	if writeFileError := writeFile(fmt.Sprintf(S3PrefixKey+"/code_list.json"), out); writeFileError != nil {
		return nil, writeFileError
	}
	if codeError := etfRepo.NewETFCode().UpdateETFCodeBatch(out); codeError != nil {
		return nil, codeError
	}
	return out, nil
}

// splitETFCodeData 分析 ETF 資料
func splitETFCodeData(v []any) []etf.ETF {
	target := ""
	if v[4] != nil {
		target = v[4].(string)
	}
	if !strings.Contains(v[0].(string), "<br>") {
		d := strings.ReplaceAll(v[0].(string), ".", "-")
		return []etf.ETF{
			{
				Date:    d,
				Code:    v[1].(string),
				Name:    v[2].(string),
				Company: v[3].(string),
				Target:  target,
				Market:  enum.StockMarketTWSE,
			},
		}
	}
	d := strings.Split(v[0].(string), "<br>")
	c := strings.Split(v[1].(string), "<br>")
	n := strings.Split(v[2].(string), "<br>")
	pattern := regexp.MustCompile(`([^0-9a-zA-Z.]+)`)
	out := make([]etf.ETF, len(c))
	for k, _ := range c {
		dateData := strings.ReplaceAll(pattern.ReplaceAllString(d[k], ""), ".", "-")
		codeData := pattern.ReplaceAllString(c[k], "")
		out[k] = etf.ETF{
			Date:    dateData,
			Code:    codeData,
			Name:    n[k],
			Company: v[3].(string),
			Target:  target,
			Market:  enum.StockMarketTWSE,
		}
	}
	return out
}

// getETFTicker 取得 ETF 股價資料
func getETFTicker(code string, date ...string) ([]etf.Ticker, error) {
	var out = make([]etf.Ticker, 0)
	d := time.Now().Format(time.DateOnly)
	if len(date) > 0 {
		inputDate, err := time.Parse("2006-01-02", date[0])
		if err != nil {
			return out, err
		}
		d = inputDate.Format(time.DateOnly)
	}
	params := url.Values{}
	params.Add("dataset", "TaiwanStockPrice")
	params.Add("data_id", code)
	params.Add("start_date", d)
	r, err := sendRequest[FinMindHistoryTicker](http.MethodGet, FinMindApiBase, params, nil)
	if err != nil {
		return out, err
	}
	for _, v := range r.Data {
		out = append(out, etf.Ticker{
			Date:  v.Date,
			Code:  v.StockId,
			Open:  v.Open,
			Max:   v.Max,
			Min:   v.Min,
			Close: v.Close,
		})
	}
	return out, nil
}

// UpdateETFTicker 更新 ETF 股價資料
func UpdateETFTicker(marketType enum.StockMarket, date ...string) {
	repoCode := etfRepo.NewETFCode()
	repoTicker := etfRepo.NewETFTicker()
	codeLists, err := repoCode.GetByMarket(marketType)
	if err != nil {
		fmt.Println("err: ", err)
		return
	}
	d := time.Now().Format(time.DateOnly)
	if len(date) > 0 {
		d = date[0]
	}
	for _, v := range codeLists {
		tickers, err := getETFTicker(v.Code, d)
		if err != nil {
			fmt.Println("err: ", err)
			continue
		}
		if dbError := repoTicker.UpdateETFTickerBatch(tickers); dbError != nil {
			fmt.Println("dbError: ", dbError.Error())
			continue
		}
		time.Sleep(time.Second * 1)
	}
}

// getTWSEHistoryDivByCode 取得證交所 ETF 股利資料
func getTWSEHistoryDivByCode(code string) ([]etf.Share, error) {
	var out = make([]etf.Share, 0)
	params := url.Values{}
	params.Add("stkNo", code)
	params.Add("startDate", "20050101")
	params.Add("endData", time.Now().Format("20060102"))
	r, err := sendRequest[ResponseData](http.MethodGet, ETFShareUrl, params, nil)
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
		out = append(out, etf.Share{
			ExDate:      exDate,
			PayableDate: payableDate,
			Share:       distribution,
			Code:        code,
			FilledDate:  time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC).Format(time.DateOnly),
		})
	}
	return out, nil
}

// getOTCHistoryDivByCode 取得櫃買中心 ETF 股利資料
func getOTCHistoryDivByCode(code string) ([]etf.Share, error) {
	var out = make([]etf.Share, 0)
	params := url.Values{}
	params.Add("stkNo", code)
	r, err := sendRequest[[]OTCETFDistribution](http.MethodPost, ETFOtcShareUrl, nil, params)
	if err != nil {
		return out, err
	}
	for _, v := range *r {
		amount := decimal.Zero
		if v.Amount != "" {
			var amountError error
			amount, amountError = decimal.NewFromString(v.Amount)
			if amountError != nil {
				amount = decimal.Zero
			}
		}
		d1, _ := helper.ROCFullDateToAD(v.DivDate, time.DateOnly)
		d2, _ := helper.ROCFullDateToAD(v.InDate, time.DateOnly)
		out = append(out, etf.Share{
			ExDate:      d1,
			PayableDate: d2,
			Share:       amount.InexactFloat64(),
			Code:        code,
			FilledDate:  time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC).Format(time.DateOnly),
		})
	}
	return out, nil
}

// UpdateETFShare 更新 ETF 股利資料
func UpdateETFShare(marketType enum.StockMarket) {
	codeLists, err := etfRepo.NewETFCode().GetByMarket(marketType)
	if err != nil {
		fmt.Println("err: ", err)
		return
	}
	repoShare := etfRepo.NewETFShare()

	for _, v := range codeLists {
		var distributions []etf.Share
		var distributionsError error
		if v.Market == enum.StockMarketTWSE {
			distributions, distributionsError = getTWSEHistoryDivByCode(v.Code)
		} else {
			distributions, distributionsError = getOTCHistoryDivByCode(v.Code)
		}
		if distributionsError != nil {
			fmt.Println("distribution error: ", err, " v: ", v, " distributions: ", distributions, "")
			continue
		}
		if len(distributions) > 0 {
			dbError := repoShare.UpdateETFTShareBatch(distributions)
			if dbError != nil {
				fmt.Println("dbError: ", dbError.Error())
			}
		}

		time.Sleep(time.Second * 2) // 休息 2 秒避免被 ban
	}
}

// GetCodeList 取得 ETF 列表
func GetCodeList() ([]etf.ETF, error) {
	return etfRepo.NewETFCode().GetAllETF()
}

// CreateCodeListFile 儲存 ETF 列表到 S3
func CreateCodeListFile() {
	rows, err := etfRepo.NewETFCode().GetAllETF()
	if err != nil {
		fmt.Println("err: ", err)
	}
	_ = writeFile(fmt.Sprintf(S3PrefixKey+"/code_list_with_share.json"), rows)
}

// GetHistoryDivByCode 取得 ETF 股利資料
func GetHistoryDivByCode(code string) (etf.ShareWithETFAndStats, error) {
	var out etf.ShareWithETFAndStats
	//return etfRepo.NewETFShare().GetETFShareByCode(code)
	resp1, err1 := etfRepo.NewETFCode().GetETFByCode(code)
	if err1 != nil {
		return out, err1
	}
	out.ETF = *resp1
	resp2, err2 := etfRepo.NewETFShare().GetETFShareByCode(code)

	if err2 != nil {
		return out, err2
	}
	out.Stats = resp2
	return out, nil
}

// GetUpcomingETFEx 取得即將除息 ETF
func GetUpcomingETFEx(startDate string, endDate ...string) ([]etf.ETF, error) {
	inst1 := etfRepo.NewETFCode()

	if len(endDate) > 0 {
		return inst1.GetUpcomingExETFByDateRange(startDate, endDate[0])
	}
	return inst1.GetUpcomingExETFByDate(startDate)
}

// GetETFTicker 取得 ETF 股價資料
func GetETFTicker(code string, startDate string, endDate string) ([]etf.Ticker, error) {
	return etfRepo.NewETFTicker().GetETFTickerByCodeAndDate(code, startDate, endDate)
}

// sendRequest 發送 HTTP 請求
func sendRequest[T any](method, uri string, params, inputBody url.Values, useFinMind ...bool) (*T, error) {
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
	if body != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	if useFinMind != nil && useFinMind[0] {
		req.Header.Set("", configInst.EnvConfig().FinMindToken)
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
	var r T
	if jsonError := json.Unmarshal(c, &r); jsonError != nil {
		return nil, jsonError
	}
	return &r, nil
}

// initS3Client 初始化 S3 Client
func initS3Client(ctx context.Context) (*s3.Client, error) {
	// 使用靜態金鑰建立 Provider
	staticProvider := credentials.NewStaticCredentialsProvider(configInst.EnvConfig().S3AccessKey, configInst.EnvConfig().S3SecretKey, "")

	// 載入設定時強制指定 CredentialsProvider 和 Region
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(configInst.EnvConfig().S3Region),
		config.WithCredentialsProvider(staticProvider),
	)
	if err != nil {
		return nil, fmt.Errorf("無法載入 AWS 設定: %v", err)
	}
	client := s3.NewFromConfig(cfg)
	return client, nil
}

// writeFile 將資料寫入 S3
func writeFile(fileName string, data any) error {
	c, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	ctx := context.TODO()
	client, err := initS3Client(ctx)
	if err != nil {
		return err
	}

	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(configInst.EnvConfig().S3Bucket),
		Key:         aws.String(fileName),
		Body:        bytes.NewReader(c),
		ContentType: aws.String("application/json"),
	})

	return err
}

func UpdateExPriceAndYieldRate() {
	inst := etfRepo.NewETFShare()
	rows, err := inst.GetExPriceAndYieldRate()
	if err != nil {
		fmt.Println("err: ", err)
		return
	}

	for _, v := range rows {
		if updateError := inst.UpdateExPriceAndYieldRate(v); updateError != nil {
			fmt.Println("err: ", err)
		}
	}
}

func UpdateFilledDays() {
	inst := etfRepo.NewETFShare()
	rows, err := inst.GetFilled()
	if err != nil {
		fmt.Println("err: ", err)
		return
	}

	for _, v := range rows {
		if v.FilledDate == time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC).Format(time.DateOnly) {
			continue
		}
		fmt.Println(
			"v.Code: ", v.Code,
			" v.FilledDate: ", v.FilledDate,
			" v.ExDate: ", v.ExDate,
			" v.PayableDate: ", v.PayableDate,
			" v.Share: ", v.Share,
		)
		if updateError := inst.UpdateFilledDays(v); updateError != nil {
			fmt.Println("err: ", err)
		}
	}
}
