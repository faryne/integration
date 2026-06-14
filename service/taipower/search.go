package taipower

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"faryne.dev/model/entity"
	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	"faryne.dev/service/search"
)

type NeighborSearchFilter struct {
	Year     int
	Month    int
	CityArea string
	Unit     string
}

func SearchNeighbors(
	input taipowerModel.NeighborSearchRequest,
	filter NeighborSearchFilter,
) (*entity.ElasticSearchResponse[taipowerModel.Neighbor], []taipowerModel.Neighbor, error) {
	query, err := buildNeighborSearchQuery(input, filter)
	if err != nil {
		return nil, nil, err
	}

	return search.Search[taipowerModel.Neighbor, taipowerModel.Neighbor](
		neighborIndexName,
		query,
		func(item taipowerModel.Neighbor) taipowerModel.Neighbor { return item },
	)
}

func ValidateNeighborSearch(input taipowerModel.NeighborSearchRequest, filter NeighborSearchFilter) error {
	_, err := buildNeighborSearchQuery(input, filter)
	return err
}

func buildNeighborSearchQuery(
	input taipowerModel.NeighborSearchRequest,
	filter NeighborSearchFilter,
) (map[string]any, error) {
	if filter.Year < 0 || filter.Month < 0 || filter.Month > 12 {
		return nil, fmt.Errorf("invalid path year/month")
	}
	if filter.Month > 0 && filter.Year == 0 {
		return nil, fmt.Errorf("year is required when month is set")
	}

	page := input.PageValue()
	perPage := input.PerPageValue()
	sortConditions, err := neighborSort(input.Sort)
	if err != nil {
		return nil, err
	}
	query := map[string]any{
		"from": (page - 1) * perPage,
		"size": perPage,
		"aggs": map[string]any{
			"total_cash": map[string]any{
				"sum": map[string]any{"field": "cash"},
			},
		},
		"sort": sortConditions,
	}

	if keyword := strings.TrimSpace(input.Keyword); keyword != "" {
		search.SetQuery(map[string]any{
			"multi_match": map[string]any{
				"query":    keyword,
				"fields":   []string{"summary", "apply_reason", "unit", "cityarea"},
				"operator": "and",
			},
		}, true, query)
	}

	if cityArea := strings.TrimSpace(filter.CityArea); cityArea != "" {
		search.SetQuery(exactTextQuery("cityarea", cityArea), true, query)
	}
	if unit := strings.TrimSpace(filter.Unit); unit != "" {
		search.SetQuery(exactTextQuery("unit", unit), true, query)
	}

	if filter.Year > 0 {
		search.SetQuery(map[string]any{"term": map[string]any{"obj_year": filter.Year}}, true, query)
		if filter.Month > 0 {
			search.SetQuery(map[string]any{"term": map[string]any{"obj_month": filter.Month}}, true, query)
		}
	} else {
		yearMonths, err := parseYearMonths(input.YearMonths)
		if err != nil {
			return nil, fmt.Errorf("yearMonths: %w", err)
		}
		if len(yearMonths) > 0 {
			search.SetQuery(selectedMonthsQuery(yearMonths), true, query)
		} else {
			from, err := parseYearMonth(input.YearMonthFrom)
			if err != nil {
				return nil, fmt.Errorf("yearMonthFrom: %w", err)
			}
			to, err := parseYearMonth(input.YearMonthTo)
			if err != nil {
				return nil, fmt.Errorf("yearMonthTo: %w", err)
			}
			if from > 0 && to > 0 && from > to {
				return nil, fmt.Errorf("yearMonthFrom must not be later than yearMonthTo")
			}
			if from > 0 || to > 0 {
				rangeCondition := map[string]any{}
				if from > 0 {
					rangeCondition["gte"] = from
				}
				if to > 0 {
					rangeCondition["lte"] = to
				}
				search.SetQuery(monthRangeQuery(rangeCondition), true, query)
			}
		}
	}

	if input.CostFrom != nil && input.CostTo != nil && *input.CostFrom >= *input.CostTo {
		return nil, fmt.Errorf("costFrom must be less than costTo")
	}
	if input.CostFrom != nil || input.CostTo != nil {
		rangeCondition := map[string]any{}
		if input.CostFrom != nil {
			rangeCondition["gte"] = *input.CostFrom
		}
		if input.CostTo != nil {
			rangeCondition["lte"] = *input.CostTo
		}
		search.SetQuery(map[string]any{"range": map[string]any{"cash": rangeCondition}}, true, query)
	}

	return query, nil
}

func neighborSort(value string) ([]map[string]any, error) {
	dateSort := []map[string]any{
		{"obj_year": map[string]any{"order": "desc"}},
		{"obj_month": map[string]any{"order": "desc"}},
		{"obj_month_id": map[string]any{"order": "desc"}},
	}
	switch strings.TrimSpace(value) {
	case "", "date_desc":
		return dateSort, nil
	case "cash_asc":
		return append(
			[]map[string]any{{"cash": map[string]any{"order": "asc"}}},
			dateSort...,
		), nil
	case "cash_desc":
		return append(
			[]map[string]any{{"cash": map[string]any{"order": "desc"}}},
			dateSort...,
		), nil
	default:
		return nil, fmt.Errorf("sort must be date_desc, cash_asc, or cash_desc")
	}
}

func parseYearMonths(value string) ([]int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	seen := make(map[int]struct{})
	months := make([]int, 0)
	for _, part := range strings.Split(value, ",") {
		month, err := parseYearMonth(part)
		if err != nil || month == 0 {
			return nil, fmt.Errorf("each value must use YYYY-MM format")
		}
		if _, ok := seen[month]; ok {
			continue
		}
		seen[month] = struct{}{}
		months = append(months, month)
	}
	return months, nil
}

func selectedMonthsQuery(yearMonths []int) map[string]any {
	conditions := make([]map[string]any, 0, len(yearMonths))
	for _, yearMonth := range yearMonths {
		conditions = append(conditions, map[string]any{
			"bool": map[string]any{
				"must": []map[string]any{
					{"term": map[string]any{"obj_year": yearMonth / 100}},
					{"term": map[string]any{"obj_month": yearMonth % 100}},
				},
			},
		})
	}
	return map[string]any{
		"bool": map[string]any{
			"should":               conditions,
			"minimum_should_match": 1,
		},
	}
}

func parseYearMonth(value string) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, nil
	}
	parsed, err := time.Parse("2006-01", value)
	if err != nil {
		return 0, fmt.Errorf("must use YYYY-MM format")
	}
	return parsed.Year()*100 + int(parsed.Month()), nil
}

func exactTextQuery(field string, value string) map[string]any {
	return map[string]any{
		"bool": map[string]any{
			"should": []map[string]any{
				{"term": map[string]any{field + ".keyword": value}},
				{"match_phrase": map[string]any{field: value}},
			},
			"minimum_should_match": 1,
		},
	}
}

func monthRangeQuery(condition map[string]any) map[string]any {
	source := "doc['obj_year'].value * 100 + doc['obj_month'].value"
	return map[string]any{
		"script": map[string]any{
			"script": map[string]any{
				"lang":   "painless",
				"source": scriptRangeSource(source, condition),
				"params": condition,
			},
		},
	}
}

func scriptRangeSource(value string, condition map[string]any) string {
	parts := make([]string, 0, 2)
	if _, ok := condition["gte"]; ok {
		parts = append(parts, value+" >= params.gte")
	}
	if _, ok := condition["lte"]; ok {
		parts = append(parts, value+" <= params.lte")
	}
	return strings.Join(parts, " && ")
}

func ParseNeighborPath(yearValue string, monthValue string) (NeighborSearchFilter, error) {
	var filter NeighborSearchFilter
	if yearValue == "" {
		return filter, nil
	}
	year, err := strconv.Atoi(yearValue)
	if err != nil || year <= 0 {
		return filter, fmt.Errorf("year must be positive")
	}
	filter.Year = year

	if monthValue == "" {
		return filter, nil
	}
	month, err := strconv.Atoi(monthValue)
	if err != nil || month < 1 || month > 12 {
		return filter, fmt.Errorf("month must be between 1 and 12")
	}
	filter.Month = month
	return filter, nil
}
