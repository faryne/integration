package storyteller

import (
	"slices"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

func TestResolveSNSPrivateKeys(t *testing.T) {
	links := storytellerModel.SNSLinks{"x": "https://x.com/a", "discord": "https://discord.gg/a"}
	current := storytellerModel.StringList{"discord", "plurk"}

	// 請求沒帶：沿用目前設定，但已經不在 links 裡的 key（plurk）要清掉
	if got := resolveSNSPrivateKeys(links, current, nil); !slices.Equal(got, storytellerModel.StringList{"discord"}) {
		t.Fatalf("omitted input should keep current keys, got %v", got)
	}
	// 請求帶空陣列：全部公開
	if got := resolveSNSPrivateKeys(links, current, &storytellerModel.StringList{}); len(got) != 0 {
		t.Fatalf("empty input should clear keys, got %v", got)
	}
	// 重複與不存在的 key 都要去掉
	input := storytellerModel.StringList{"x", "x", "youtube"}
	if got := resolveSNSPrivateKeys(links, current, &input); !slices.Equal(got, storytellerModel.StringList{"x"}) {
		t.Fatalf("unexpected normalized keys: %v", got)
	}
}

func TestPublicIdentityHidesPrivateSNSLinks(t *testing.T) {
	links := storytellerModel.SNSLinks{"x": "https://x.com/a", "discord": "https://discord.gg/a"}
	self := selfIdentityOutput(&storytellerModel.UserProfile{PenName: "a", SNSLinks: links, SNSPrivateKeys: storytellerModel.StringList{"discord"}, CreatedAt: time.Now()})
	extra := extraIdentityOutput(&storytellerModel.AuthorProfile{PenName: "b", SNSLinks: links, SNSPrivateKeys: storytellerModel.StringList{"discord"}})
	for _, output := range []storytellerModel.AuthorIdentityOutput{self, extra} {
		if _, ok := output.SNSLinks["discord"]; ok || output.SNSLinks["x"] == "" {
			t.Fatalf("public identity should hide private links only, got %v", output.SNSLinks)
		}
	}
	// 本人看的輸出要全帶，並告訴前端哪些是私密
	owner := authorProfileOutput(&storytellerModel.AuthorProfile{PenName: "b", SNSLinks: links, SNSPrivateKeys: storytellerModel.StringList{"discord"}})
	if len(owner.SNSLinks) != 2 || !slices.Equal(owner.SNSPrivateKeys, []string{"discord"}) {
		t.Fatalf("owner output should include every link and private keys, got %+v", owner)
	}
	// 原本的 links 不能被過濾動到（避免公開輸出把本人資料改壞）
	if len(links) != 2 {
		t.Fatalf("PublicSNSLinks must not mutate the source map")
	}
}
