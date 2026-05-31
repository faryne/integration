package nico

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"time"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nm "faryne.dev/service/nekomaid"
)

type instance struct {
	SimpleBaseEndpoint string `json:"simple_base_endpoint"`
	DetailBaseEndpoint string `json:"detail_base_endpoint"`
}

func New() nm.RetrieverInterface {
	return &instance{
		SimpleBaseEndpoint: "https://seiga.nicovideo.jp/api/illust/info",
		DetailBaseEndpoint: "https://sp.seiga.nicovideo.jp/ajax/seiga/%s",
	}
}

type SimpleResponse struct {
	Image struct {
		Id           int64  `xml:"id"`
		UserId       int64  `xml:"user_id"`
		Title        string `xml:"title"`
		Description  string `xml:"description"`
		Summary      string `xml:"summary"`
		PublicStatus int64  `xml:"public_status"`
		AdultLevel   int64  `xml:"adult_level"`
	} `xml:"image"`
}

type DetailResponse struct {
	TargetImage struct {
		Id       string `json:"id"`
		UserId   string `json:"user_id"`
		Nickname string `json:"nickname"`
		ImageUrl string `json:"image_url"`
		Tags     struct {
			Items []struct {
				Name string `json:"name"`
			} `json:"items"`
		} `json:"tags"`
	} `json:"target_image"`
}

func (i *instance) Login() error {
	return nil
}

func (i *instance) Get(id string) (*nekomaid.ArtworkMain, error) {
	client := http.Client{}

	// Step 1: Get Simple Info
	req1, _ := http.NewRequest(http.MethodGet, i.SimpleBaseEndpoint+"?id="+id, nil)
	resp1, err := client.Do(req1)
	if err != nil {
		return nil, err
	}
	defer resp1.Body.Close()
	var output1 SimpleResponse
	data1, _ := io.ReadAll(resp1.Body)
	xml.Unmarshal(data1, &output1)

	// Step 2: Get Detail Info
	req2, _ := http.NewRequest(http.MethodGet, fmt.Sprintf(i.DetailBaseEndpoint, id), nil)
	resp2, err := client.Do(req2)
	if err != nil {
		return nil, err
	}
	defer resp2.Body.Close()
	var output2 DetailResponse
	json.NewDecoder(resp2.Body).Decode(&output2)

	return i.parseGetArtwork(&output1, &output2)
}

func (i *instance) parseGetArtwork(simpleResponse *SimpleResponse, detailResponse *DetailResponse) (*nekomaid.ArtworkMain, error) {
	var o = &nekomaid.ArtworkMain{
		Site:      "nico",
		AuthorId:  detailResponse.TargetImage.UserId,
		ArtworkId: fmt.Sprintf("im%d", simpleResponse.Image.Id),
		Title:     simpleResponse.Image.Title,
		IsR18:     simpleResponse.Image.AdultLevel > 1,
		CreatedOn: time.Now(),
	}

	var tags []string
	for _, v := range detailResponse.TargetImage.Tags.Items {
		tags = append(tags, v.Name)
	}

	client := http.Client{}
	req, _ := http.NewRequest(http.MethodGet, detailResponse.TargetImage.ImageUrl, nil)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	img, thumb, err := nm.UploadImage(enum.NekomaidSiteNico, o.AuthorId, o.ArtworkId, resp, 0)
	if err != nil {
		return nil, err
	}

	o.FullContent = nekomaid.ArtworkMainFullContent{
		From:        enum.NekomaidSiteNico,
		AuthorId:    o.AuthorId,
		ArtworkId:   o.ArtworkId,
		IsR18:       map[bool]int{true: 1, false: 0}[o.IsR18],
		Title:       o.Title,
		Author:      detailResponse.TargetImage.Nickname,
		Photos:      []nekomaid.ArtworkPhoto{img},
		Tags:        tags,
		Thumb:       thumb,
		PreviewUrl:  fmt.Sprintf(nm.PreviewUrlPattern, enum.NekomaidSiteNico, o.AuthorId, o.ArtworkId),
		Description: simpleResponse.Image.Description,
	}

	return o, nil
}
