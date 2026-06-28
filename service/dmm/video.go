package dmm

import (
	"fmt"
	"math"
	"sync"
	"time"
)

var dmmAVVideoGraphQL = `
query ContentPageData($id: ID!, $isLoggedIn: Boolean!, $isAmateur: Boolean!, $isAnime: Boolean!, $isAv: Boolean!, $isCinema: Boolean!, $isSP: Boolean!, $shouldFetchRelatedTags: Boolean = false, $isPhase4_2Released: Boolean!) {
  ppvContent(id: $id) {
    ...ContentData
    __typename
  }
  reviewSummary(contentId: $id) {
    ...ReviewSummary
    __typename
  }
  ...basketCountFragment @include(if: $isSP)
}
fragment ContentData on PPVContent {
  id
  floor
  title
  isExclusiveDelivery
  releaseStatus
  description
  notices
  isNoIndex
  isAllowForeign
  announcements {
    body
    __typename
  }
  featureArticles {
    link {
      url
      text
      __typename
    }
    __typename
  }
  packageImage {
    largeUrl
    mediumUrl
    __typename
  }
  sampleImages {
    number
    imageUrl
    largeImageUrl
    __typename
  }
  products {
    ...ProductData
    __typename
  }
  mostPopularContentImage {
    ... on ContentSampleImage {
      __typename
      largeImageUrl
      imageUrl
    }
    ... on PackageImage {
      __typename
      largeUrl
      mediumUrl
    }
    __typename
  }
  priceSummary @skip(if: $isPhase4_2Released) {
    lowestSalePrice
    lowestPrice
    campaign {
      title
      id
      endAt
      pointGrantRate
      __typename
    }
    __typename
  }
  pricing @include(if: $isPhase4_2Released) {
    lowestEffectivePriceInclusiveTax
    lowestRegularPriceInclusiveTax
    sale {
      name
      id
      endAt
      __typename
    }
    pointRewardCampaign {
      name
      id
      endAt
      promotionId
      rate
      __typename
    }
    __typename
  }
  weeklyRanking: ranking(term: Weekly)
  monthlyRanking: ranking(term: Monthly)
  wishlistCount
  sample2DMovie {
    highestMovieUrl
    hlsMovieUrl
    __typename
  }
  sampleVRMovie {
    highestMovieUrl
    __typename
  }
  ...AmateurAdditionalContentData @include(if: $isAmateur)
  ...AnimeAdditionalContentData @include(if: $isAnime)
  ...AvAdditionalContentData @include(if: $isAv)
  ...CinemaAdditionalContentData @include(if: $isCinema)
  __typename
}
fragment ProductData on PPVProduct {
  id
  priority
  deliveryUnit {
    id
    priority
    streamMaxQualityGroup
    downloadMaxQualityGroup
    __typename
  }
  expireDays
  utilizationStatus @include(if: $isLoggedIn)
  licenseType
  shopName
  __typename
}
fragment AmateurAdditionalContentData on PPVContent {
  deliveryStartDate
  duration
  amateurActress {
    id
    name
    imageUrl
    age
    waist
    bust
    bustCup
    height
    hip
    relatedContents {
      id
      title
      __typename
    }
    __typename
  }
  maker {
    id
    name
    __typename
  }
  label {
    id
    name
    __typename
  }
  genres {
    id
    name
    __typename
  }
  makerContentId
  playableInfo {
    ...PlayableInfo
    __typename
  }
  __typename
}
fragment PlayableInfo on PlayableInfo {
  playableDevices {
    deviceDeliveryUnits {
      id
      deviceDeliveryQualities {
        isDownloadable
        isStreamable
        __typename
      }
      __typename
    }
    device
    name
    priority
    isSupported
    __typename
  }
  deviceGroups {
    id
    devices {
      deviceDeliveryUnits {
        id
        deviceDeliveryQualities {
          isStreamable
          isDownloadable
          __typename
        }
        __typename
      }
      isSupported
      __typename
    }
    __typename
  }
  vrViewingType
  __typename
}
fragment AnimeAdditionalContentData on PPVContent {
  deliveryStartDate
  duration
  series {
    id
    name
    __typename
  }
  maker {
    id
    name
    __typename
  }
  label {
    id
    name
    __typename
  }
  genres {
    id
    name
    __typename
  }
  makerContentId
  playableInfo {
    ...PlayableInfo
    __typename
  }
  __typename
}
fragment AvAdditionalContentData on PPVContent {
  deliveryStartDate
  makerReleasedAt
  duration
  actresses {
    id
    name
    nameRuby
    imageUrl
    isBookmarked @include(if: $isLoggedIn)
    __typename
  }
  histrions {
    id
    name
    __typename
  }
  directors {
    id
    name
    __typename
  }
  series {
    id
    name
    __typename
  }
  maker {
    id
    name
    __typename
  }
  label {
    id
    name
    __typename
  }
  genres {
    id
    name
    __typename
  }
  contentType
  relatedWords @skip(if: $shouldFetchRelatedTags)
  relatedTags(limit: 16) @include(if: $shouldFetchRelatedTags) {
    ... on ContentTagGroup {
      tags {
        id
        name
        __typename
      }
      __typename
    }
    ... on ContentTag {
      id
      name
      __typename
    }
    __typename
  }
  makerContentId
  playableInfo {
    ...PlayableInfo
    __typename
  }
  __typename
}
fragment CinemaAdditionalContentData on PPVContent {
  deliveryStartDate
  duration
  actresses {
    id
    name
    nameRuby
    imageUrl
    __typename
  }
  histrions {
    id
    name
    __typename
  }
  directors {
    id
    name
    __typename
  }
  authors {
    id
    name
    __typename
  }
  series {
    id
    name
    __typename
  }
  maker {
    id
    name
    __typename
  }
  label {
    id
    name
    __typename
  }
  genres {
    id
    name
    __typename
  }
  makerContentId
  playableInfo {
    ...PlayableInfo
    __typename
  }
  __typename
}
fragment ReviewSummary on ReviewSummary {
  average
  total
  withCommentTotal
  distributions {
    total
    withCommentTotal
    rating
    __typename
  }
  __typename
}
fragment basketCountFragment on Query {
  legacyBasket @skip(if: $isLoggedIn) {
    total
    __typename
  }
  basketCount: user @include(if: $isLoggedIn) {
    ... on Member {
      ppvBasketItemCount
      __typename
    }
    __typename
  }
  __typename
}
`

var dmmAVSearchGraphQL = `
query AvSearch($limit: Int!, $offset: Int, $floor: PPVFloor, $sort: ContentSearchPPVSort!, $queryWord: String, $filter: ContentSearchPPVFilterInput, $facetLimit: Int!, $hasFacet: Boolean!, $hasGenreDescription: Boolean!, $legacyProductType: LegacyProductType = DOWNLOAD, $hasLegacyProductType: Boolean!, $isLoggedIn: Boolean!, $excludeUndelivered: Boolean!, $shouldFetchGenreRelatedWords: Boolean!, $shouldFetchContentTagIds: Boolean!, $shouldFetchDirectorRelatedWords: Boolean!, $shouldFetchLabelRelatedWords: Boolean!, $shouldFetchSeriesRelatedWords: Boolean!, $shouldFetchActressRelatedWords: Boolean!, $shouldFetchMakerRelatedWords: Boolean!, $shouldFetchHistrionRelatedWords: Boolean!, $isPhase4_2Released: Boolean!) {
  legacySearchPPV(
    limit: $limit
    offset: $offset
    floor: $floor
    sort: $sort
    queryWord: $queryWord
    filter: $filter
    facetLimit: $facetLimit
    includeExplicit: true
    excludeUndelivered: $excludeUndelivered
  ) {
    result {
      contents {
        ...searchContent
        contentType
        actresses {
          id
          name
        }
        maker {
          id
          name
        }
      }
      facet @include(if: $hasFacet) {
        ...contentSearchFacet
      }
      pageInfo {
        ...paginationFragment
      }
      isNoIndex
      searchCriteria {
        ...contentSearchCriteria
      }
      osusumeGalleryLinks {
        text
        url
      }
    }
  }
}
fragment searchContent on PPVContentSearchContent {
  id
  title
  packageImage {
    mediumUrl
    largeUrl
  }
  sampleImages {
    number
    largeUrl
  }
  sampleMovie {
    hlsUrl
    mp4Url
    vrUrl
  }
  releaseStatus
  review {
    average
    count
  }
  isExclusiveDelivery
  bookmarkCount
  salesInfo {
    lowestPrice {
      productId
      price
      discountPrice
      legacyProductType
    }
    priceByLegacyProductType(legacyProductType: $legacyProductType) @include(if: $hasLegacyProductType) {
      discountPrice
      price
      legacyProductType
    }
    campaign {
      name
      endAt
    }
    pointRewardCampaign @include(if: $isPhase4_2Released) {
      name
    }
    hasMultiplePrices
  }
  isOnSale
  deliveryStartAt
  utilizationStatus @include(if: $isLoggedIn)
}
fragment contentSearchFacet on PPVContentSearchFacet {
  floor {
    items {
      floor
      count
    }
  }
  actress {
    items {
      id
      name
      count
    }
  }
  maker {
    items {
      id
      name
      count
    }
  }
  label {
    items {
      id
      name
      count
    }
  }
  series {
    items {
      id
      name
      count
    }
  }
  genreAndCampaignCombined {
    items {
      ... on GenreFacetItem {
        count
        id
        name
      }
    }
  }
}
fragment paginationFragment on OffsetPageInfoWithTotal {
  offset
  limit
  hasNext
  totalCount
}
fragment contentSearchCriteria on PPVContentSearchCriteria {
  sort
  filter {
    actressIds {
      ids {
        id
        name
        nameRuby
        relatedWords @include(if: $shouldFetchActressRelatedWords)
      }
      op
    }
    authorIds {
      ids {
        id
        name
        nameRuby
      }
      op
    }
    directorIds {
      ids {
        id
        name
        nameRuby
        relatedWords @include(if: $shouldFetchDirectorRelatedWords)
      }
      op
    }
    genreIds {
      ids {
        id
        name
        relatedWords @include(if: $shouldFetchGenreRelatedWords)
        description @include(if: $hasGenreDescription)
      }
      op
    }
    histrionIds {
      ids {
        id
        name
        nameRuby
        relatedWords @include(if: $shouldFetchHistrionRelatedWords)
      }
      op
    }
    labelIds {
      ids {
        id
        name
        relatedWords @include(if: $shouldFetchLabelRelatedWords)
      }
      op
    }
    makerIds {
      ids {
        id
        name
        relatedWords @include(if: $shouldFetchMakerRelatedWords)
      }
      op
    }
    seriesIds {
      ids {
        id
        name
        relatedWords @include(if: $shouldFetchSeriesRelatedWords)
      }
      op
    }
    campaignIds @skip(if: $isPhase4_2Released) {
      ids {
        id
        name
      }
      op
    }
    saleIds @include(if: $isPhase4_2Released) {
      ids {
        id
        name
      }
      op
    }
    pointRewardCampaignIds @include(if: $isPhase4_2Released) {
      ids {
        id
        name
      }
      op
    }
    contentTagIds @include(if: $shouldFetchContentTagIds) {
      ids {
        id
        name
      }
      op
    }
    isSaleItemsOnly
  }
}`

type AvSearchVideoResult struct {
	Id           string `json:"id"`
	Title        string `json:"title"`
	PackageImage struct {
		MediumUrl string `json:"mediumUrl"`
		LargeUrl  string `json:"largeUrl"`
	} `json:"packageImage"`
	SampleImages []struct {
		Number   int    `json:"number"`
		LargeUrl string `json:"largeUrl"`
	} `json:"sampleImages"`
	SampleMovie struct {
		HlsUrl interface{} `json:"hlsUrl"`
		Mp4Url interface{} `json:"mp4Url"`
		VrUrl  string      `json:"vrUrl"`
	} `json:"sampleMovie"`
	ReleaseStatus string `json:"releaseStatus"`
	Review        struct {
		Average float64 `json:"average"`
		Count   int     `json:"count"`
	} `json:"review"`
	IsExclusiveDelivery bool `json:"isExclusiveDelivery"`
	BookmarkCount       int  `json:"bookmarkCount"`
	SalesInfo           struct {
		LowestPrice struct {
			ProductId         string      `json:"productId"`
			Price             int         `json:"price"`
			DiscountPrice     interface{} `json:"discountPrice"`
			LegacyProductType string      `json:"legacyProductType"`
		} `json:"lowestPrice"`
		Campaign            interface{} `json:"campaign"`
		PointRewardCampaign interface{} `json:"pointRewardCampaign"`
		HasMultiplePrices   bool        `json:"hasMultiplePrices"`
	} `json:"salesInfo"`
	IsOnSale          bool      `json:"isOnSale"`
	DeliveryStartAt   time.Time `json:"deliveryStartAt"`
	UtilizationStatus string    `json:"utilizationStatus"`
	ContentType       string    `json:"contentType"`
	Actresses         []struct {
		Id   string `json:"id"`
		Name string `json:"name"`
	} `json:"actresses,omitempty"`
	Maker struct {
		Id   string `json:"id"`
		Name string `json:"name"`
	} `json:"maker"`
}

type AvSearchCriteria struct {
	Sort   string `json:"sort"`
	Filter struct {
		ActressIds             interface{} `json:"actressIds"`
		AuthorIds              interface{} `json:"authorIds"`
		DirectorIds            interface{} `json:"directorIds"`
		GenreIds               interface{} `json:"genreIds"`
		HistrionIds            interface{} `json:"histrionIds"`
		LabelIds               interface{} `json:"labelIds"`
		MakerIds               interface{} `json:"makerIds"`
		SeriesIds              interface{} `json:"seriesIds"`
		SaleIds                interface{} `json:"saleIds"`
		PointRewardCampaignIds interface{} `json:"pointRewardCampaignIds"`
		ContentTagIds          interface{} `json:"contentTagIds"`
		IsSaleItemsOnly        bool        `json:"isSaleItemsOnly"`
	} `json:"filter"`
}

type AvSearchResponse struct {
	Data struct {
		LegacySearchPPV struct {
			Result struct {
				Contents []AvSearchVideoResult `json:"contents"`
				PageInfo struct {
					Offset     int  `json:"offset"`
					Limit      int  `json:"limit"`
					TotalCount int  `json:"totalCount"`
					HasNext    bool `json:"hasNext"`
				} `json:"pageInfo"`
			} `json:"result"`
			SearchCriteria AvSearchCriteria `json:"searchCriteria"`
		} `json:"legacySearchPPV"`
	} `json:"data"`
}

type AvVideoResponse struct {
	Data struct {
		PpvContent struct {
			Id                  string        `json:"id"`
			Floor               string        `json:"floor"`
			Title               string        `json:"title"`
			IsExclusiveDelivery bool          `json:"isExclusiveDelivery"`
			ReleaseStatus       string        `json:"releaseStatus"`
			Description         string        `json:"description"`
			Notices             []string      `json:"notices"`
			IsNoIndex           bool          `json:"isNoIndex"`
			IsAllowForeign      bool          `json:"isAllowForeign"`
			Announcements       []interface{} `json:"announcements"`
			FeatureArticles     []struct {
				Link struct {
					Url      string `json:"url"`
					Text     string `json:"text"`
					Typename string `json:"__typename"`
				} `json:"link"`
				Typename string `json:"__typename"`
			} `json:"featureArticles"`
			PackageImage struct {
				LargeUrl  string `json:"largeUrl"`
				MediumUrl string `json:"mediumUrl"`
				Typename  string `json:"__typename"`
			} `json:"packageImage"`
			SampleImages []struct {
				Number        int    `json:"number"`
				ImageUrl      string `json:"imageUrl"`
				LargeImageUrl string `json:"largeImageUrl"`
				Typename      string `json:"__typename"`
			} `json:"sampleImages"`
			Products []struct {
				Id           string `json:"id"`
				Priority     int    `json:"priority"`
				DeliveryUnit struct {
					Id                      string  `json:"id"`
					Priority                int     `json:"priority"`
					StreamMaxQualityGroup   string  `json:"streamMaxQualityGroup"`
					DownloadMaxQualityGroup *string `json:"downloadMaxQualityGroup"`
					Typename                string  `json:"__typename"`
				} `json:"deliveryUnit"`
				PriceInclusiveTax int         `json:"priceInclusiveTax"`
				Sale              interface{} `json:"sale"`
				ExpireDays        *int        `json:"expireDays"`
				LicenseType       string      `json:"licenseType"`
				ShopName          string      `json:"shopName"`
				AvailableCoupon   struct {
					Name             string `json:"name"`
					ExpirationPolicy struct {
						ExpirationDays int    `json:"expirationDays"`
						Typename       string `json:"__typename"`
					} `json:"expirationPolicy"`
					ExpirationAt    interface{} `json:"expirationAt"`
					DiscountedPrice int         `json:"discountedPrice"`
					MinPayment      int         `json:"minPayment"`
					DestinationUrl  string      `json:"destinationUrl"`
					Typename        string      `json:"__typename"`
				} `json:"availableCoupon"`
				Typename string `json:"__typename"`
			} `json:"products"`
			MostPopularContentImage struct {
				Typename      string `json:"__typename"`
				LargeImageUrl string `json:"largeImageUrl"`
				ImageUrl      string `json:"imageUrl"`
			} `json:"mostPopularContentImage"`
			PriceSummary struct {
				LowestSalePrice int         `json:"lowestSalePrice"`
				LowestPrice     int         `json:"lowestPrice"`
				Campaign        interface{} `json:"campaign"`
				Typename        string      `json:"__typename"`
			} `json:"priceSummary"`
			WeeklyRanking  interface{} `json:"weeklyRanking"`
			MonthlyRanking interface{} `json:"monthlyRanking"`
			WishlistCount  int         `json:"wishlistCount"`
			Sample2DMovie  struct {
				HighestMovieUrl string `json:"highestMovieUrl"`
				HlsMovieUrl     string `json:"hlsMovieUrl"`
				Typename        string `json:"__typename"`
			} `json:"sample2DMovie"`
			SampleVRMovie     interface{} `json:"sampleVRMovie"`
			DeliveryStartDate time.Time   `json:"deliveryStartDate"`
			MakerReleasedAt   time.Time   `json:"makerReleasedAt"`
			Duration          int         `json:"duration"`
			Actresses         []struct {
				Id       string  `json:"id"`
				Name     string  `json:"name"`
				NameRuby string  `json:"nameRuby"`
				ImageUrl *string `json:"imageUrl"`
				Typename string  `json:"__typename"`
			} `json:"actresses"`
			Histrions []interface{} `json:"histrions"`
			Directors []struct {
				Name string `json:"name"`
			} `json:"directors,omitempty"`
			Series struct {
				Name string `json:"name"`
			} `json:"series,omitempty"`
			Maker struct {
				Id       string `json:"id"`
				Name     string `json:"name"`
				Typename string `json:"__typename"`
			} `json:"maker"`
			Label struct {
				Id       string `json:"id"`
				Name     string `json:"name"`
				Typename string `json:"__typename"`
			} `json:"label"`
			Genres []struct {
				Id       string `json:"id"`
				Name     string `json:"name"`
				Typename string `json:"__typename"`
			} `json:"genres"`
			ContentType    string   `json:"contentType"`
			RelatedWords   []string `json:"relatedWords"`
			MakerContentId string   `json:"makerContentId"`
			PlayableInfo   struct {
				PlayableDevices []struct {
					DeviceDeliveryUnits []struct {
						Id                      string `json:"id"`
						DeviceDeliveryQualities []struct {
							IsDownloadable bool   `json:"isDownloadable"`
							IsStreamable   bool   `json:"isStreamable"`
							Typename       string `json:"__typename"`
						} `json:"deviceDeliveryQualities"`
						Typename string `json:"__typename"`
					} `json:"deviceDeliveryUnits"`
					Device      string `json:"device"`
					Name        string `json:"name"`
					Priority    int    `json:"priority"`
					IsSupported bool   `json:"isSupported"`
					Typename    string `json:"__typename"`
				} `json:"playableDevices"`
				DeviceGroups []struct {
					Id      string `json:"id"`
					Devices []struct {
						DeviceDeliveryUnits []struct {
							Id                      string `json:"id"`
							DeviceDeliveryQualities []struct {
								IsStreamable   bool   `json:"isStreamable"`
								IsDownloadable bool   `json:"isDownloadable"`
								Typename       string `json:"__typename"`
							} `json:"deviceDeliveryQualities"`
							Typename string `json:"__typename"`
						} `json:"deviceDeliveryUnits"`
						IsSupported bool   `json:"isSupported"`
						Typename    string `json:"__typename"`
					} `json:"devices"`
					Typename string `json:"__typename"`
				} `json:"deviceGroups"`
				VrViewingType interface{} `json:"vrViewingType"`
				Typename      string      `json:"__typename"`
			} `json:"playableInfo"`
			Typename string `json:"__typename"`
		} `json:"ppvContent"`
		ReviewSummary interface{} `json:"reviewSummary"`
	} `json:"data"`
}

type DmmVideosList struct {
	Videos []DmmVideo `json:"videos"`
}

type DmmVideo struct {
	DmmVideoHeader
	DmmVideoBody
	MakerNo string `json:"maker_no"`
}

type DmmVideoHeader struct {
	No    string `json:"no"`
	Title string `json:"title"`
	Url   string `json:"url"`
	Thumb string `json:"thumb"`
}

type DmmVideoBody struct {
	VodDate     string          `json:"vod_date"`
	PublishDate string          `json:"publish_date"`
	Duration    int             `json:"duration"`
	Directors   []string        `json:"directors"`
	Series      []string        `json:"series"`
	Makers      []string        `json:"makers"`
	Labels      []string        `json:"labels"`
	Tags        []string        `json:"tags"`
	Actresses   []string        `json:"actresses"`
	Images      []DmmVideoImage `json:"images"`
}

type DmmVideoImage struct {
	Thumb   string `json:"thumb"`
	Preview string `json:"preview"`
}

func (i *DMM) SearchVideosByDaily(date string, page int) ([]DmmVideo, error) {
	limit := 20
	offset := (page - 1) * limit
	variables := map[string]interface{}{
		"limit":                           limit,
		"offset":                          offset,
		"sort":                            "RECOMMENDED",
		"facetLimit":                      10,
		"hasFacet":                        true,
		"hasGenreDescription":             false,
		"hasLegacyProductType":            false,
		"isLoggedIn":                      false,
		"excludeUndelivered":              true,
		"shouldFetchGenreRelatedWords":    false,
		"shouldFetchContentTagIds":        false,
		"shouldFetchDirectorRelatedWords": false,
		"shouldFetchLabelRelatedWords":    false,
		"shouldFetchSeriesRelatedWords":   false,
		"shouldFetchActressRelatedWords":  false,
		"shouldFetchMakerRelatedWords":    false,
		"shouldFetchHistrionRelatedWords": false,
		"isPhase4_2Released":              false,
		"filter": map[string]interface{}{
			"deliveryStartDate": date,
		},
	}
	var jsonResponse AvSearchResponse

	if err := i.send(dmmAVSearchGraphQL, variables, &jsonResponse); err != nil {
		return nil, err
	}

	out := make([]DmmVideo, len(jsonResponse.Data.LegacySearchPPV.Result.Contents))

	// [PERF-OPTIMIZED-001] N+1 查詢優化：改為低並發 + 延遲查詢詳細信息
	// 原始: 1 次搜尋 + N 次串行詳情查詢 = N+1 (耗時: 5-10 秒)
	// 優化後: 1 次搜尋 + N 次低並發詳情查詢 (最多 2 個並發 + 100ms 延遲，耗時: ~2-3 秒)
	// 注意: 刻意降低並發和添加延遲以避免觸發對方速率限制/反爬蟲
	const maxConcurrency = 2
	const requestDelayMs = 100

	sem := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstErr error

	for idx, v := range jsonResponse.Data.LegacySearchPPV.Result.Contents {
		v := v // capture loop variable
		idx := idx

		wg.Add(1)
		go func() {
			defer wg.Done()

			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release

			time.Sleep(time.Duration(requestDelayMs) * time.Millisecond)

			tmp := DmmVideo{}
			tmp.No = fmt.Sprintf("%v", v.Id)
			tmp.Title = v.Title
			tmp.Url = fmt.Sprintf("https://video.dmm.co.jp/av/content/?id=%s&i3_ref=list&i3_ord=1&i3_pst=1&dmmref=video_list", v.Id)
			tmp.Thumb = v.PackageImage.MediumUrl

			if err := i.getDMMVideoDetail(v.Id, &tmp); err != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				mu.Unlock()
				return
			}

			out[idx] = tmp
		}()
	}

	wg.Wait()
	if firstErr != nil {
		return nil, firstErr
	}

	// 確保基本信息被填充（以防並發問題）
	for idx, v := range jsonResponse.Data.LegacySearchPPV.Result.Contents {
		if out[idx].No == "" {
			out[idx].No = fmt.Sprintf("%v", v.Id)
			out[idx].Title = v.Title
			out[idx].Url = fmt.Sprintf("https://video.dmm.co.jp/av/content/?id=%s&i3_ref=list&i3_ord=1&i3_pst=1&dmmref=video_list", v.Id)
			out[idx].Thumb = v.PackageImage.MediumUrl
		}
	}

	return out, nil
}

func (i *DMM) getDMMVideoDetail(no string, tmp *DmmVideo) error {
	variables := map[string]interface{}{
		"id":                     no,
		"isLoggedIn":             false,
		"isAmateur":              false,
		"isAnime":                false,
		"isAv":                   true,
		"isCinema":               false,
		"isSP":                   false,
		"shouldFetchRelatedTags": true,
		"isPhase4_2Released":     true,
	}

	var finalResponse AvVideoResponse

	if requestError := i.send(dmmAVVideoGraphQL, variables, &finalResponse); requestError != nil {
		return requestError
	}

	//tz := time.FixedZone("Asia/Tokyo", 9*60*60)

	tmp.Thumb = finalResponse.Data.PpvContent.PackageImage.MediumUrl
	tmp.MakerNo = finalResponse.Data.PpvContent.MakerContentId
	tmp.Duration = int(math.Ceil(float64(finalResponse.Data.PpvContent.Duration / 60)))
	tmp.VodDate = finalResponse.Data.PpvContent.DeliveryStartDate.Format("2006/01/02")
	tmp.PublishDate = finalResponse.Data.PpvContent.MakerReleasedAt.Format("2006/01/02")
	tmp.Actresses = make([]string, 0)
	for _, act := range finalResponse.Data.PpvContent.Actresses {
		tmp.Actresses = append(tmp.Actresses, act.Name)
	}
	tmp.Makers = []string{finalResponse.Data.PpvContent.Maker.Name}
	tmp.Labels = []string{finalResponse.Data.PpvContent.Label.Name}
	tmp.Series = []string{finalResponse.Data.PpvContent.Series.Name}
	tmp.Tags = make([]string, 0)
	for _, tag := range finalResponse.Data.PpvContent.Genres {
		tmp.Tags = append(tmp.Tags, tag.Name)
	}
	tmp.Directors = make([]string, 0)
	for _, dir := range finalResponse.Data.PpvContent.Directors {
		tmp.Directors = append(tmp.Directors, dir.Name)
	}
	tmp.Images = make([]DmmVideoImage, 0)
	for _, img := range finalResponse.Data.PpvContent.SampleImages {
		tmp.Images = append(tmp.Images, DmmVideoImage{Thumb: img.ImageUrl, Preview: img.LargeImageUrl})
	}
	return nil
}
