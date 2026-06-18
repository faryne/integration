package nccc

import (
	"bytes"
	"compress/gzip"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/text/encoding/traditionalchinese"
	"golang.org/x/text/transform"
)

func TestExpandDataSetURLs(t *testing.T) {
	urls := expandDataSetURLs("/Gender/BANK_%{AREA}_%{TYPE}_GD.CSV")

	require.Len(t, urls, len(regions)*len(consumeTypes))
	require.Contains(t, urls, "/Gender/BANK_TPE_FD_GD.CSV")
	require.Contains(t, urls, "/Gender/BANK_LCH_OT_GD.CSV")
}

func TestExpandDataSetURLsLeavesUnusedPlaceholdersAlone(t *testing.T) {
	urls := expandDataSetURLs("/EC/BANK_EC_%{TYPE}.CSV")

	require.Len(t, urls, len(consumeTypes))
	require.Contains(t, urls, "/EC/BANK_EC_FD.CSV")
}

func TestSelectDataSetKeysDefaultsToAllDataSets(t *testing.T) {
	keys, err := selectDataSetKeys()

	require.NoError(t, err)
	require.Equal(t, dataSetKeys(), keys)
}

func TestParseDocuments(t *testing.T) {
	content := []byte("\ufeff年度,筆數,金額\r\n113年01月,10,200\r\n合計,10,200\r\n,1,2\r\n")

	parsed, err := parseDocuments("gender", content)
	documents := parsed.Documents

	require.NoError(t, err)
	require.Len(t, documents, 1)
	require.Equal(t, "113年01月", documents[0]["年度"])
	require.Equal(t, float64(10), documents[0]["筆數"])
	require.Equal(t, float64(200), documents[0]["金額"])
	require.Equal(t, "gender", documents[0]["id_key"])
}

func TestParseDocumentsAcceptsGregorianYearMonth(t *testing.T) {
	content := []byte("\ufeff年月,地區,信用卡產業別,年齡層,信用卡交易筆數,信用卡交易金額[新臺幣]\r\n201401,10018000,行,未滿20歲,68,36399\r\n")

	parsed, err := parseDocuments("age", content)
	documents := parsed.Documents

	require.NoError(t, err)
	require.Len(t, documents, 1)
	require.Equal(t, "103年01月", documents[0]["年月"])
	require.Equal(t, "新竹市", documents[0]["地區"])
	require.Equal(t, "行", documents[0]["信用卡產業別"])
	require.Equal(t, float64(68), documents[0]["信用卡交易筆數"])
	require.Contains(t, parsed.FirstRow, "年月=201401")
	require.Contains(t, parsed.FirstRow, "地區=10018000")
}

func TestNormalizeCSVFieldKeepsCategoryCodesAsStrings(t *testing.T) {
	require.Equal(t, "新竹市", normalizeCSVField("地區", "10018000"))
	require.Equal(t, "99999999", normalizeCSVField("地區", "99999999"))
	require.Equal(t, "台北市", normalizeCSVField("地區", "台北市"))
	require.Equal(t, "行", normalizeCSVField("信用卡產業別", "行"))
	require.Equal(t, float64(68), normalizeCSVField("信用卡交易筆數", "68"))
}

func TestIsDataRow(t *testing.T) {
	require.True(t, isDataRow("113年01月"))
	require.True(t, isDataRow("201401"))
	require.False(t, isDataRow("合計"))
	require.False(t, isDataRow(""))
}

func TestParseDocumentsExpandsRegionalColumns(t *testing.T) {
	content := []byte("\ufeff年月,類別,台北市[筆數],台北市[金額，新台幣],新北市[筆數],新北市[金額，新台幣]\r\n113年01月,食,10,200,30,400\r\n")

	parsed, err := parseDocuments("by_region_total", content)
	documents := parsed.Documents

	require.NoError(t, err)
	require.Len(t, documents, 2)
	require.Equal(t, "台北市", documents[0]["地區"])
	require.Equal(t, float64(10), documents[0]["[筆數]"])
	require.Equal(t, float64(200), documents[0]["[金額，新台幣]"])
	require.Equal(t, "新北市", documents[1]["地區"])
	require.Equal(t, float64(30), documents[1]["[筆數]"])
	require.NotContains(t, documents[0], "台北市[筆數]")
}

func TestParseDocumentsDecodesBig5Content(t *testing.T) {
	source := "年度,筆數,金額\r\n113年01月,10,200\r\n"
	var encoded bytes.Buffer
	writer := transform.NewWriter(&encoded, traditionalchinese.Big5.NewEncoder())
	_, err := writer.Write([]byte(source))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	parsed, err := parseDocuments("gender", encoded.Bytes())
	documents := parsed.Documents

	require.NoError(t, err)
	require.Len(t, documents, 1)
	require.Equal(t, "113年01月", documents[0]["年度"])
	require.Equal(t, float64(10), documents[0]["筆數"])
}

func TestParseDocumentsDecodesGzipContent(t *testing.T) {
	source := []byte("\ufeff年度,筆數,金額\r\n113年01月,10,200\r\n")
	var encoded bytes.Buffer
	writer := gzip.NewWriter(&encoded)
	_, err := writer.Write(source)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	parsed, err := parseDocuments("gender", encoded.Bytes())
	documents := parsed.Documents

	require.NoError(t, err)
	require.Len(t, documents, 1)
	require.Equal(t, "113年01月", documents[0]["年度"])
}

func TestNormalizeRegionalHeader(t *testing.T) {
	city, header, ok := normalizeRegionalHeader("台北市[金額，新台幣]")

	require.True(t, ok)
	require.Equal(t, "台北市", city)
	require.Equal(t, "[金額，新台幣]", header)

	_, header, ok = normalizeRegionalHeader("未達50萬[筆數]")
	require.False(t, ok)
	require.Equal(t, "未達50萬[筆數]", header)
}

func TestNormalizeCSVValue(t *testing.T) {
	require.Equal(t, float64(2947924), normalizeCSVValue("2947924"))
	require.Equal(t, float64(2915352976), normalizeCSVValue("2,915,352,976"))
	require.Equal(t, 123.45, normalizeCSVValue("123.45"))
	require.Equal(t, "103年09月", normalizeCSVValue("103年09月"))
	require.Equal(t, "台北市", normalizeCSVValue("台北市"))
	require.Equal(t, "", normalizeCSVValue(""))
}

func TestInferDocumentFields(t *testing.T) {
	fields := inferDocumentFields([]map[string]any{
		{"年月": "113年01月", "[筆數]": float64(10), "id_key": "by_region_total"},
	})

	require.Equal(t, "string", fields["年月"])
	require.Equal(t, "number", fields["[筆數]"])
}

func TestDocumentIDIsStable(t *testing.T) {
	doc := map[string]any{
		"年度":     "113年01月",
		"筆數":     float64(10),
		"id_key": "gender",
	}

	id1, err := documentID(doc)
	require.NoError(t, err)
	id2, err := documentID(doc)
	require.NoError(t, err)

	require.Len(t, id1, 64)
	require.Equal(t, id1, id2)
}

func TestBackupKey(t *testing.T) {
	now := time.Date(2026, time.June, 18, 12, 0, 0, 0, time.Local)

	key := backupKey("age", "/Age%20Group/BANK_TPE_FD_AG.CSV", now)

	require.Equal(t, "nccc/data/age/20260618/BANK_TPE_FD_AG.CSV", key)
}

func TestApplyBrowserHeaders(t *testing.T) {
	req, err := http.NewRequest(http.MethodGet, baseURL+"/Gender/BANK_TPE_FD_GD.CSV", nil)
	require.NoError(t, err)

	applyBrowserHeaders(req)

	require.Contains(t, req.Header.Get("User-Agent"), "Mozilla/5.0")
	require.Contains(t, req.Header.Get("Accept"), "text/csv")
	require.Contains(t, req.Header.Get("Accept-Language"), "zh-TW")
	require.Empty(t, req.Header.Get("Accept-Encoding"))
	require.Equal(t, baseURL+"/", req.Header.Get("Referer"))
}
