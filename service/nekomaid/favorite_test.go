package nekomaid

import (
	"errors"
	"strings"
	"testing"
)

// 只測寫入 DB 前就會擋下的標籤格式
func TestSetFavoriteTagValidation(t *testing.T) {
	for _, tag := range []string{"", "   ", strings.Repeat("字", favoriteTagMaxLength+1)} {
		if err := SetFavoriteTag(1, tag, true); !errors.Is(err, ErrForbiddenInvalid) {
			t.Fatalf("tag %q: err = %v, want ErrForbiddenInvalid", tag, err)
		}
	}
}
