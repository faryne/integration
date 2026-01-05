package opendata

import (
	"faryne.dev/service/dmm"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
	"net/http"
	"strconv"
	"time"
)

var dmmAVActressSearchGraphQL = `
query ActressesSyllabary($floor: Floor!, $sort: ActressesSort!, $syllabary: [Syllabary!], $classification: ActressClassification = AV, $hasThumbnailImageUrl: Boolean = false, $isLoggedIn: Boolean = false, $limit: Int = 100, $offset: Int = 0) {
  actresses(
    floor: $floor
    sort: $sort
    syllabary: $syllabary
    classification: $classification
    limit: $limit
    offset: $offset
  ) {
    items {
      id
      name
      nameRuby
      imageUrl @skip(if: $hasThumbnailImageUrl)
      thumbnailImageUrl @include(if: $hasThumbnailImageUrl)
      contentsCount
      isBookmarked @include(if: $isLoggedIn)
      __typename
    }
    pageInfo {
      ...paginationFragment
      __typename
    }
    __typename
  }
}
fragment paginationFragment on OffsetPageInfoWithTotal {
  offset
  limit
  hasNext
  totalCount
  __typename
}
`

func DMMDailyVideo(ctx fiber.Ctx) error {
	dParams := ctx.Query("date", "")
	_, err := time.Parse(time.DateOnly, dParams)
	if err != nil {
		return output.BadRequest(err)
	}
	page, pageError := strconv.Atoi(ctx.Query("page", "1"))
	if pageError != nil {
		return output.BadRequest(pageError)
	}
	dmmInstance := dmm.NewDMMClient()

	videos, videosError := dmmInstance.SearchVideosByDaily(dParams, page)
	if videosError != nil {
		return output.New(http.StatusInternalServerError, "", nil, videosError.Error())
	}
	var finalResponse = dmm.DmmVideosList{Videos: videos}
	return output.Success(finalResponse)

}
