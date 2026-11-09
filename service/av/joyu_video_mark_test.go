package av

import "testing"

// 番號一律存小寫，格式不對（空白、符號、太長）回空字串
func TestNormalizeVideoNo(t *testing.T) {
	cases := map[string]string{
		" MIDV00900 ":                          "midv00900",
		"h_1234abc00001":                       "h_1234abc00001",
		"midv-900":                             "",
		"":                                     "",
		"a":                                    "",
		"<script>":                             "",
		"abcdefghijklmnopqrstuvwxyz0123456789": "",
	}
	for in, want := range cases {
		if got := normalizeVideoNo(in); got != want {
			t.Fatalf("%q: got %q, want %q", in, got, want)
		}
	}
}
