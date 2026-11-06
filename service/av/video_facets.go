package av

import (
	"context"

	"faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
)

// VideoFacets 依目前搜尋條件統計常見的標籤／發售商／系列／出演，
// 讓搜尋頁與 MCP 可以一步步縮小範圍；條件組裝與 VideoSearch 共用 videoIndexQuery
func VideoFacets(input av.VideoQueryRequest) (av.VideoFacets, error) {
	q, err := videoIndexQuery(input)
	if err != nil {
		return av.VideoFacets{}, err
	}
	return avRepo.NewVideoIndex().Facets(context.Background(), q)
}
