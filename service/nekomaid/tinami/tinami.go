package tinami

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"time"

	"faryne.dev/config"
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nm "faryne.dev/service/nekomaid"
)

type instance struct {
	ApiKey string `json:"api_key"`
	Base   string `json:"base"`
}

func New() nm.RetrieverInterface {
	cfg := config.EnvConfig()
	return &instance{
		ApiKey: cfg.NekomaidTinamiKey,
		Base:   "https://www.tinami.com/api",
	}
}

type image struct {
	Url string `xml:"url"`
}

type Response struct {
	Stat    string `xml:"stat,attr"`
	Content struct {
		Title   string `xml:"title"`
		Creator struct {
			Id   int64  `xml:"id,attr"`
			Name string `xml:"name"`
		} `xml:"creator"`
		AgeLevel    int64  `xml:"age_level"`
		Description string `xml:"description"`
		Type        string `xml:"type,attr"`
		Image       image  `xml:"image"`
		Images      struct {
			Items []image `xml:"image"`
		} `xml:"images"`
		Tags struct {
			Items []string `xml:"tag"`
		} `xml:"tags"`
	} `xml:"content"`
}

func (i *instance) Login() error {
	return nil
}

func (i *instance) Get(id string) (*nekomaid.ArtworkMain, error) {
	apiUrl := fmt.Sprintf("%s/content/info?api_key=%s&cont_id=%s", i.Base, i.ApiKey, id)
	resp, err := http.Get(apiUrl)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result Response
	if err := xml.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return i.parseGetArtwork(id, &result)
}

func (i *instance) parseGetArtwork(id string, response *Response) (*nekomaid.ArtworkMain, error) {
	var o = &nekomaid.ArtworkMain{
		Site:      enum.NekomaidSiteTinami,
		AuthorId:  fmt.Sprintf("%d", response.Content.Creator.Id),
		ArtworkId: "ti" + id,
		Title:     response.Content.Title,
		IsR18:     response.Content.AgeLevel > 1,
		CreatedOn: time.Now(),
	}

	var photos []nekomaid.ArtworkPhoto
	var thumb string

	if response.Content.Type == "illust" {
		p, t, err := i.getImageUpload(o.ArtworkId, response.Content.Image.Url, 0)
		if err != nil {
			return nil, err
		}
		thumb = t
		photos = append(photos, p)
	} else {
		for idx, img := range response.Content.Images.Items {
			p, t, err := i.getImageUpload(o.ArtworkId, img.Url, idx)
			if err != nil {
				return nil, err
			}
			if idx == 0 {
				thumb = t
			}
			photos = append(photos, p)
		}
	}

	o.FullContent = nekomaid.ArtworkMainFullContent{
		From:        enum.NekomaidSiteTinami,
		AuthorId:    o.AuthorId,
		ArtworkId:   o.ArtworkId,
		IsR18:       map[bool]int{true: 1, false: 0}[o.IsR18],
		Title:       o.Title,
		Author:      response.Content.Creator.Name,
		Photos:      photos,
		Tags:        response.Content.Tags.Items,
		Thumb:       thumb,
		PreviewUrl:  fmt.Sprintf(nm.PreviewUrlPattern, enum.NekomaidSiteTinami, o.AuthorId, o.ArtworkId),
		Description: response.Content.Description,
	}

	return o, nil
}

func (i *instance) getImageUpload(id string, u string, idx int) (nekomaid.ArtworkPhoto, string, error) {
	resp, err := http.Get(u)
	if err != nil {
		return nekomaid.ArtworkPhoto{}, "", err
	}
	defer resp.Body.Close()

	return nm.UploadImage(id, resp, idx)
}
