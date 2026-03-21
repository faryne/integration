package crawler

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"net/url"
	"testing"
)

func Test_CrawlByUri(t *testing.T) {
	baseUri := "https://xcity.jp/idol/"
	params := url.Values{}
	params.Add("kana", "あ")
	params.Add("num", "90")
	params.Add("page", "1")
	uri := baseUri + "?" + params.Encode()
	t.Logf("uri:%s", uri)

	resp, err := CrawlByUrl(uri, []SelectorRequest{
		{
			Name:     "actress",
			Pattern:  "div.itemBox > div.mid",
			Multiple: true,
			Children: []SelectorRequest{
				{
					Name:     "image",
					Pattern:  "p.tn > a > img",
					Attrs:    []string{"src", "alt", "class"},
					Multiple: false,
				},
				{
					Name:     "data",
					Pattern:  "p.name > a",
					Multiple: false,
					Trim:     true,
					Attrs:    []string{"href", "title"},
					Children: []SelectorRequest{
						{
							Name:     "Image",
							Pattern:  "img",
							Attrs:    []string{"src", "alt", "class"},
							Multiple: false,
						},
					},
				},
			},
		},
	})
	require.NoError(t, err)

	c, _ := json.MarshalIndent(resp, "", "  ")
	t.Logf("%s", string(c))
}
