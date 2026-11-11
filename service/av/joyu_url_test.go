package av

import "testing"

func TestJoyuVideoURL(t *testing.T) {
	cases := []struct{ makerNo, no, want string }{
		{"SSIS-001", "ssis00001", "https://joyu.fyi/video/SSIS-001"},
		// 沒有 maker_no 時用大寫的 no
		{"", "h_237nact00198", "https://joyu.fyi/video/H_237NACT00198"},
	}
	for _, c := range cases {
		if got := JoyuVideoURL(c.makerNo, c.no); got != c.want {
			t.Errorf("JoyuVideoURL(%q, %q) = %q, want %q", c.makerNo, c.no, got, c.want)
		}
	}
}

func TestJoyuActressURL(t *testing.T) {
	cases := []struct {
		name, domain string
		aid          int
		want         string
	}{
		{"三上悠亜", "xcity", 1234, "https://joyu.fyi/actress/%E4%B8%89%E4%B8%8A%E6%82%A0%E4%BA%9C?xcity_id=1234"},
		{"新人ちゃん", "manual", 56, "https://joyu.fyi/actress/%E6%96%B0%E4%BA%BA%E3%81%A1%E3%82%83%E3%82%93?manual_id=56"},
		// 名字裡的斜線、空白要跳脫，不能變成另一層路徑
		{"A/B C", "xcity", 1, "https://joyu.fyi/actress/A%2FB%20C?xcity_id=1"},
		// 沒有 aid 就只照名字
		{"桃尻うらら", "xcity", 0, "https://joyu.fyi/actress/%E6%A1%83%E5%B0%BB%E3%81%86%E3%82%89%E3%82%89"},
	}
	for _, c := range cases {
		if got := JoyuActressURL(c.name, c.domain, c.aid); got != c.want {
			t.Errorf("JoyuActressURL(%q, %q, %d) = %q, want %q", c.name, c.domain, c.aid, got, c.want)
		}
	}
}
