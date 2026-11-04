package nekomaid

import (
	"errors"
	"testing"

	"faryne.dev/model/enum"
)

func TestNormalizeForbiddenTarget(t *testing.T) {
	cases := []struct {
		name                    string
		site, author, artwork   string
		wantSite                enum.NekomaidSite
		wantAuthor, wantArtwork string
		wantInvalid             bool
	}{
		{name: "整個畫師", site: " Pixiv ", author: " 82517969 ", wantSite: enum.NekomaidSitePixiv, wantAuthor: "82517969"},
		{name: "只給作品", site: "nico", artwork: "12345", wantSite: enum.NekomaidSiteNico, wantArtwork: "12345"},
		{name: "tinami 作品補 ti 前綴", site: "tinami", author: "1", artwork: "999", wantSite: enum.NekomaidSiteTinami, wantAuthor: "1", wantArtwork: "ti999"},
		{name: "tinami 已有前綴不重複補", site: "tinami", author: "1", artwork: "ti999", wantSite: enum.NekomaidSiteTinami, wantAuthor: "1", wantArtwork: "ti999"},
		{name: "不支援的站", site: "twitter", author: "1", wantInvalid: true},
		{name: "畫師與作品都空", site: "pixiv", wantInvalid: true},
		{name: "ID 含非法字元", site: "pixiv", author: "1 OR 1=1", wantInvalid: true},
		{name: "ID 超過欄位長度", site: "pixiv", author: "1234567890123456", wantInvalid: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			site, author, artwork, err := normalizeForbiddenTarget(tc.site, tc.author, tc.artwork)
			if tc.wantInvalid {
				if !errors.Is(err, ErrForbiddenInvalid) {
					t.Fatalf("err = %v, want ErrForbiddenInvalid", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected err: %v", err)
			}
			if site != tc.wantSite || author != tc.wantAuthor || artwork != tc.wantArtwork {
				t.Fatalf("got (%s, %s, %s), want (%s, %s, %s)", site, author, artwork, tc.wantSite, tc.wantAuthor, tc.wantArtwork)
			}
		})
	}
}
