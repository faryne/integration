package rates

// RateQueryResult 對外查詢（MCP）回傳：附上實際套用的日期區間與銀行中文名，讓呼叫端不用另外查
type RateQueryResult struct {
	BeginDate string            `json:"begin_date"`
	EndDate   string            `json:"end_date"`
	Banks     map[string]string `json:"banks"` // service_name → 中文名
	Rates     []Rate            `json:"rates"`
}
