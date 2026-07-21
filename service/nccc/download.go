package nccc

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"faryne.dev/config"
	"faryne.dev/service/log"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"
	"golang.org/x/text/encoding/traditionalchinese"
	"golang.org/x/text/transform"
)

const bulkChunkSize = 500

var (
	rocYearMonthPattern       = regexp.MustCompile(`^[0-9]{2,}年[0-9]{1,2}月$`)
	gregorianYearMonthPattern = regexp.MustCompile(`^[0-9]{6}$`)
)

type Service struct {
	httpClient *http.Client
	now        func() time.Time
}

type DownloadResult struct {
	DataSet    string
	URL        string
	S3Key      string
	Indexed    int
	Downloaded int64
	Fields     map[string]string
	Documents  []map[string]any
}

type IndexFileEntry struct {
	Name    string              `json:"name"`
	Text    string              `json:"text"`
	Fields  map[string]string   `json:"fields"`
	Filters map[string][]string `json:"filters,omitempty"`
}

type parseResult struct {
	Documents      []map[string]any
	Rows           int
	Headers        []string
	FirstColumn    []string
	FirstRow       []string
	SampleRows     []string
	DecodedContent []byte
}

func NewService() *Service {
	return &Service{
		httpClient: &http.Client{Timeout: 60 * time.Second},
		now:        time.Now,
	}
}

func RunDownload(dataSetKey ...string) {
	results, err := NewService().Download(context.Background(), dataSetKey...)
	if err != nil {
		log.Logger().Error("NCCC download failed: " + err.Error())
		return
	}
	totalIndexed := 0
	for _, result := range results {
		totalIndexed += result.Indexed
	}
	log.Logger().Info("NCCC download finished",
		zap.Int("files", len(results)),
		zap.Int("indexed", totalIndexed),
	)
}

func (s *Service) Download(ctx context.Context, dataSetKey ...string) ([]DownloadResult, error) {
	s3Client, err := newS3Client(ctx)
	if err != nil {
		return nil, err
	}

	keys, err := selectDataSetKeys(dataSetKey...)
	if err != nil {
		return nil, err
	}

	totalFiles := 0
	expandedURLs := make(map[string][]string, len(keys))
	for _, dataSetKey := range keys {
		urls := expandDataSetURLs(dataSets[dataSetKey].URL, dataSets[dataSetKey].ExcludeTypes...)
		expandedURLs[dataSetKey] = urls
		totalFiles += len(urls)
	}

	results := make([]DownloadResult, 0)
	indexFields := make(map[string]map[string]string)
	indexFilters := make(map[string]map[string]map[string]struct{})
	var joinedErr error
	currentFile := 0
	for _, dataSetKey := range keys {
		for _, rawPath := range expandedURLs[dataSetKey] {
			currentFile++
			log.Logger().Info("NCCC downloading file",
				zap.String("dataset", dataSetKey),
				zap.String("file", rawPath),
				zap.Int("current", currentFile),
				zap.Int("total", totalFiles),
			)
			result, err := s.downloadOne(ctx, s3Client, dataSetKey, rawPath)
			if err != nil {
				joinedErr = errors.Join(joinedErr, fmt.Errorf("%s %s: %w", dataSetKey, rawPath, err))
				log.Logger().Error("NCCC file failed",
					zap.String("dataset", dataSetKey),
					zap.String("file", rawPath),
					zap.Int("current", currentFile),
					zap.Int("total", totalFiles),
					zap.Error(err),
				)
				continue
			}
			mergeIndexFields(indexFields, dataSetKey, result.Fields)
			mergeIndexFilters(indexFilters, dataSetKey, result.Documents)
			results = append(results, result)
			log.Logger().Info("NCCC file indexed",
				zap.String("dataset", dataSetKey),
				zap.String("file", rawPath),
				zap.String("index", ncccIndexName(dataSetKey)),
				zap.Int("indexed", result.Indexed),
				zap.Int("current", currentFile),
				zap.Int("total", totalFiles),
			)
		}
	}
	if err := uploadIndexFile(ctx, s3Client, indexFields, indexFilters); err != nil {
		joinedErr = errors.Join(joinedErr, err)
	}

	return results, joinedErr
}

func selectDataSetKeys(dataSetKey ...string) ([]string, error) {
	if len(dataSetKey) == 0 || strings.TrimSpace(dataSetKey[0]) == "" {
		return dataSetKeys(), nil
	}
	key := strings.TrimSpace(dataSetKey[0])
	if _, ok := dataSets[key]; !ok {
		return nil, fmt.Errorf("unknown NCCC data set key: %s", key)
	}
	return []string{key}, nil
}

func (s *Service) downloadOne(ctx context.Context, s3Client *s3.Client, dataSetKey string, rawPath string) (DownloadResult, error) {
	fullURL := baseURL + "/" + strings.TrimPrefix(rawPath, "/")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL, nil)
	if err != nil {
		return DownloadResult{}, err
	}
	applyBrowserHeaders(req)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return DownloadResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return DownloadResult{}, fmt.Errorf("download failed: status=%s", resp.Status)
	}
	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return DownloadResult{}, err
	}

	s3Key := backupKey(dataSetKey, rawPath, s.now())
	if err := uploadRawCSV(ctx, s3Client, s3Key, content); err != nil {
		return DownloadResult{}, err
	}

	parsed, err := parseDocuments(dataSetKey, content)
	if err != nil {
		return DownloadResult{}, err
	}
	log.Logger().Info("NCCC file parsed",
		zap.String("dataset", dataSetKey),
		zap.String("file", rawPath),
		zap.Int("rows", parsed.Rows),
		zap.Int("documents", len(parsed.Documents)),
		zap.Strings("headers", parsed.Headers),
		zap.Strings("first_column", parsed.FirstColumn),
		zap.Strings("first_row", parsed.FirstRow),
	)
	if len(parsed.Documents) == 0 {
		return DownloadResult{}, fmt.Errorf(
			"parsed zero documents: rows=%d headers=%v first_column=%v first_row=%v sample_rows=%v",
			parsed.Rows,
			parsed.Headers,
			parsed.FirstColumn,
			parsed.FirstRow,
			parsed.SampleRows,
		)
	}
	documents := parsed.Documents
	if err := indexDocuments(ctx, dataSetKey, documents); err != nil {
		return DownloadResult{}, err
	}

	return DownloadResult{
		DataSet:    dataSetKey,
		URL:        fullURL,
		S3Key:      s3Key,
		Indexed:    len(documents),
		Downloaded: int64(len(content)),
		Fields:     inferDocumentFields(documents),
		Documents:  documents,
	}, nil
}

func applyBrowserHeaders(req *http.Request) {
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/csv,application/vnd.ms-excel,application/octet-stream;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Referer", baseURL+"/")
}

func expandDataSetURLs(pattern string, excludeTypes ...string) []string {
	exclude := make(map[string]struct{}, len(excludeTypes))
	for _, t := range excludeTypes {
		exclude[t] = struct{}{}
	}

	output := []string{pattern}
	keys := make([]string, 0, len(defaultPlaceholders))
	for key := range defaultPlaceholders {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		values := defaultPlaceholders[key]
		if key == "TYPE" && len(exclude) > 0 {
			filtered := make([]string, 0, len(values))
			for _, value := range values {
				if _, skip := exclude[value]; !skip {
					filtered = append(filtered, value)
				}
			}
			values = filtered
		}
		next := make([]string, 0, len(output)*len(values))
		for _, current := range output {
			if !strings.Contains(current, "%{"+key+"}") {
				next = append(next, current)
				continue
			}
			for _, value := range values {
				next = append(next, strings.ReplaceAll(current, "%{"+key+"}", value))
			}
		}
		output = next
	}

	seen := make(map[string]struct{}, len(output))
	unique := make([]string, 0, len(output))
	for _, item := range output {
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		unique = append(unique, item)
	}
	return unique
}

func parseDocuments(dataSetKey string, content []byte) (parseResult, error) {
	decodedContent, err := decodeCSVContent(content)
	if err != nil {
		return parseResult{}, err
	}
	reader := csv.NewReader(bytes.NewReader(decodedContent))
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true
	rows, err := reader.ReadAll()
	if err != nil {
		return parseResult{}, err
	}
	result := parseResult{
		Rows:           len(rows),
		SampleRows:     sampleCSVRows(rows, 5),
		DecodedContent: decodedContent,
	}
	if len(rows) == 0 {
		return result, nil
	}

	headers := normalizeHeaders(rows[0])
	result.Headers = sampleStrings(headers, 20)
	result.FirstColumn = sampleFirstColumn(rows, 20)
	result.FirstRow = firstDataRow(headers, rows)
	documents := make([]map[string]any, 0, len(rows)-1)
	for _, row := range rows[1:] {
		if len(row) == 0 || !isDataRow(row[0]) {
			continue
		}
		document := make(map[string]any, len(headers)+1)
		regionalDocuments := make(map[string]map[string]any)
		for i, header := range headers {
			if header == "" {
				continue
			}
			value := any("")
			if i < len(row) {
				value = normalizeCSVField(header, row[i])
			}
			if city, normalizedHeader, ok := normalizeRegionalHeader(header); ok {
				regionalDocument, exists := regionalDocuments[city]
				if !exists {
					regionalDocument = make(map[string]any)
					regionalDocuments[city] = regionalDocument
				}
				regionalDocument["地區"] = city
				regionalDocument[normalizedHeader] = value
				continue
			}
			document[header] = value
		}
		if len(regionalDocuments) > 0 {
			cities := make([]string, 0, len(regionalDocuments))
			for city := range regionalDocuments {
				cities = append(cities, city)
			}
			sort.Strings(cities)
			for _, city := range cities {
				regionalDocument := make(map[string]any, len(document)+len(regionalDocuments[city])+1)
				for key, value := range document {
					regionalDocument[key] = value
				}
				for key, value := range regionalDocuments[city] {
					regionalDocument[key] = value
				}
				regionalDocument["id_key"] = dataSetKey
				documents = append(documents, regionalDocument)
			}
			continue
		}
		document["id_key"] = dataSetKey
		documents = append(documents, document)
	}
	result.Documents = documents
	return result, nil
}

func firstDataRow(headers []string, rows [][]string) []string {
	for _, row := range rows[1:] {
		if len(row) == 0 || !isDataRow(row[0]) {
			continue
		}
		out := make([]string, 0, len(headers))
		for i, header := range headers {
			value := ""
			if i < len(row) {
				value = strings.TrimSpace(row[i])
			}
			out = append(out, fmt.Sprintf("%s=%s", header, value))
		}
		return out
	}
	return nil
}

func sampleFirstColumn(rows [][]string, limit int) []string {
	out := make([]string, 0, limit)
	for i, row := range rows {
		if i == 0 {
			continue
		}
		if len(row) == 0 {
			continue
		}
		out = append(out, strings.TrimSpace(row[0]))
		if len(out) >= limit {
			break
		}
	}
	return out
}

func sampleCSVRows(rows [][]string, limit int) []string {
	out := make([]string, 0, limit)
	for _, row := range rows {
		parts := make([]string, 0, len(row))
		for _, value := range row {
			parts = append(parts, strings.TrimSpace(value))
		}
		out = append(out, strings.Join(parts, "|"))
		if len(out) >= limit {
			break
		}
	}
	return out
}

func sampleStrings(values []string, limit int) []string {
	if len(values) <= limit {
		return values
	}
	return values[:limit]
}

func decodeCSVContent(content []byte) ([]byte, error) {
	if len(content) >= 2 && content[0] == 0x1f && content[1] == 0x8b {
		reader, err := gzip.NewReader(bytes.NewReader(content))
		if err != nil {
			return nil, err
		}
		defer reader.Close()
		content, err = io.ReadAll(reader)
		if err != nil {
			return nil, err
		}
	}
	if utf8.Valid(content) {
		return content, nil
	}
	decoded, err := io.ReadAll(transform.NewReader(bytes.NewReader(content), traditionalchinese.Big5.NewDecoder()))
	if err != nil {
		return nil, err
	}
	return decoded, nil
}

func isDataRow(firstColumn string) bool {
	value := strings.TrimSpace(firstColumn)
	if value == "" {
		return false
	}
	return rocYearMonthPattern.MatchString(value) || gregorianYearMonthPattern.MatchString(value)
}

func normalizeCSVField(header string, value string) any {
	value = strings.TrimSpace(value)
	if _, ok := stringFieldNames[header]; ok {
		if header == "年月" {
			return normalizeYearMonth(value)
		}
		if header == "地區" {
			return normalizeRegion(value)
		}
		return value
	}
	if header == "年月" {
		return normalizeYearMonth(value)
	}
	return normalizeCSVValue(value)
}

func normalizeRegion(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	code, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return value
	}
	if city, ok := codeCities[code]; ok {
		return city
	}
	return value
}

func normalizeYearMonth(value string) string {
	value = strings.TrimSpace(value)
	if gregorianYearMonthPattern.MatchString(value) {
		year, err := strconv.Atoi(value[:4])
		if err != nil {
			return value
		}
		month := value[4:]
		return fmt.Sprintf("%d年%s月", year-1911, month)
	}
	return value
}

func normalizeRegionalHeader(header string) (string, string, bool) {
	for _, city := range chineseCities {
		if strings.HasPrefix(header, city+"[") {
			return city, strings.TrimPrefix(header, city), true
		}
	}
	return "", header, false
}

func normalizeCSVValue(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	normalized := strings.ReplaceAll(value, ",", "")
	if number, err := strconv.ParseFloat(normalized, 64); err == nil {
		return number
	}
	return value
}

func normalizeHeaders(headers []string) []string {
	output := make([]string, len(headers))
	for i, header := range headers {
		output[i] = strings.TrimPrefix(strings.TrimSpace(header), "\ufeff")
	}
	return output
}

func documentID(document map[string]any) (string, error) {
	body, err := json.Marshal(document)
	if err != nil {
		return "", err
	}
	hash := hmac.New(sha256.New, []byte(documentIDKey))
	hash.Write(body)
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func backupKey(dataSetKey string, rawPath string, now time.Time) string {
	fileName := path.Base(rawPath)
	if decoded, err := url.PathUnescape(fileName); err == nil {
		fileName = decoded
	}
	return fmt.Sprintf("%s/%s/%s/%s", s3DataPrefix, dataSetKey, now.Format("20060102"), fileName)
}

func newS3Client(ctx context.Context) (*s3.Client, error) {
	cfg := config.EnvConfig()
	credentialsProvider := credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, "")
	awsCfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithCredentialsProvider(credentialsProvider),
	)
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}
	return s3.NewFromConfig(awsCfg), nil
}

func uploadRawCSV(ctx context.Context, s3Client *s3.Client, key string, content []byte) error {
	_, err := s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(config.EnvConfig().S3Bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(content),
		ContentType: aws.String("text/csv; charset=utf-8"),
	})
	if err != nil {
		return fmt.Errorf("upload %s: %w", key, err)
	}
	return nil
}

func inferDocumentFields(documents []map[string]any) map[string]string {
	fields := make(map[string]string)
	for _, document := range documents {
		for key, value := range document {
			valueType := indexFieldType(value)
			if current, ok := fields[key]; !ok || current == "" || (current == "number" && valueType == "string") {
				fields[key] = valueType
			}
		}
	}
	return fields
}

func mergeIndexFields(indexFields map[string]map[string]string, dataSetKey string, fields map[string]string) {
	indexName := ncccIndexName(dataSetKey)
	currentFields, ok := indexFields[indexName]
	if !ok {
		currentFields = make(map[string]string)
		indexFields[indexName] = currentFields
	}
	for key, valueType := range fields {
		if current, ok := currentFields[key]; !ok || current == "" || (current == "number" && valueType == "string") {
			currentFields[key] = valueType
		}
	}
}

func mergeIndexFilters(indexFilters map[string]map[string]map[string]struct{}, dataSetKey string, documents []map[string]any) {
	indexName := ncccIndexName(dataSetKey)
	currentFilters, ok := indexFilters[indexName]
	if !ok {
		currentFilters = make(map[string]map[string]struct{})
		indexFilters[indexName] = currentFilters
	}
	for _, document := range documents {
		for field, value := range document {
			if !indexFilterField(field) {
				continue
			}
			text := strings.TrimSpace(fmt.Sprint(value))
			if text == "" {
				continue
			}
			values, ok := currentFilters[field]
			if !ok {
				values = make(map[string]struct{})
				currentFilters[field] = values
			}
			values[text] = struct{}{}
		}
	}
}

func indexFilterField(field string) bool {
	if field == "年月" || field == "年度" || field == "id_key" {
		return false
	}
	_, ok := stringFieldNames[field]
	return ok
}

func indexFieldType(value any) string {
	switch value.(type) {
	case int, int64, float32, float64:
		return "number"
	case bool:
		return "boolean"
	default:
		return "string"
	}
}

func uploadIndexFile(ctx context.Context, s3Client *s3.Client, indexFields map[string]map[string]string, indexFilters map[string]map[string]map[string]struct{}) error {
	entries := make([]IndexFileEntry, 0, len(indexFields))
	names := make([]string, 0, len(indexFields))
	for name := range indexFields {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		dataSetKey := strings.TrimPrefix(name, "nccc_")
		entries = append(entries, IndexFileEntry{
			Name:    name,
			Text:    dataSets[dataSetKey].Text,
			Fields:  indexFields[name],
			Filters: sortedIndexFilters(indexFilters[name]),
		})
	}
	content, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return err
	}
	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(config.EnvConfig().S3Bucket),
		Key:          aws.String("nccc/index.json"),
		Body:         bytes.NewReader(content),
		ContentType:  aws.String("application/json; charset=utf-8"),
		CacheControl: aws.String("public, max-age=3600"),
	})
	if err != nil {
		return fmt.Errorf("upload nccc/index.json: %w", err)
	}
	return nil
}

func sortedIndexFilters(filters map[string]map[string]struct{}) map[string][]string {
	if len(filters) == 0 {
		return nil
	}
	out := make(map[string][]string, len(filters))
	for field, values := range filters {
		items := make([]string, 0, len(values))
		for value := range values {
			items = append(items, value)
		}
		sortFilterValues(field, items)
		out[field] = items
	}
	return out
}

func sortFilterValues(field string, values []string) {
	if field != "地區" {
		sort.Slice(values, func(i, j int) bool {
			return values[i] < values[j]
		})
		return
	}
	ranks := make(map[string]int, len(chineseCities))
	for index, city := range chineseCities {
		ranks[city] = index
	}
	sort.Slice(values, func(i, j int) bool {
		rankI, okI := ranks[values[i]]
		rankJ, okJ := ranks[values[j]]
		if okI && okJ {
			return rankI < rankJ
		}
		if okI {
			return true
		}
		if okJ {
			return false
		}
		return values[i] < values[j]
	})
}
