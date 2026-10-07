package twstats

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func TestSearchFiltersAndPaginatesIndicators(t *testing.T) {
	service := testService(`{"population":"人口總數","density":"人口密度","income":"家庭所得"}`)
	result, err := service.Search(context.Background(), "人口", 1, 1)

	require.NoError(t, err)
	require.Equal(t, 2, result.Total)
	require.Len(t, result.Data, 1)
	require.Contains(t, result.Data[0].PageURL, "/data/tw-stats/")
}

func TestRetrieveFiltersYearsAndAreas(t *testing.T) {
	service := testService(`{
		"2023":{"Name":"人口總數","Unit":"人","Explain":"年底人口","Total":"23,000,000","Taiwan":"23,000,000","Taipei":"2,400,000"},
		"2024":{"Name":"人口總數","Unit":"人","Explain":"年底人口","Total":"23,100,000","Taiwan":"23,100,000","Taipei":"2,500,000"}
	}`)
	result, err := service.Retrieve(context.Background(), RetrieveRequest{
		Name: "人口總數", StartYear: 2023, EndYear: 2024, Years: []int{2024}, Areas: []string{"台灣", "Taipei"},
	})

	require.NoError(t, err)
	require.Equal(t, "人", result.Unit)
	require.Equal(t, map[string]string{"Taiwan": "台灣", "Taipei": "台北市"}, result.Areas)
	require.Equal(t, []YearData{{
		Year: 2024, Total: "23,100,000", Values: map[string]string{"Taiwan": "23,100,000", "Taipei": "2,500,000"},
	}}, result.Data)
}

func TestRetrieveRejectsUnsupportedArea(t *testing.T) {
	service := testService(`{}`)
	_, err := service.Retrieve(context.Background(), RetrieveRequest{Name: "人口總數", Areas: []string{"不存在"}})
	require.EqualError(t, err, "unsupported area: 不存在")
}

func testService(body string) *Service {
	return &Service{
		baseURL: "https://example.test/docs",
		client: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(body)),
			}, nil
		})},
	}
}
