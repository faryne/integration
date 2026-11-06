package mail

import (
	"errors"
	"testing"
)

func TestMessageValidate(t *testing.T) {
	ok := Message{From: "a@example.com", To: []string{"b@example.com"}, Subject: "s", Text: "t"}
	if err := ok.validate(); err != nil {
		t.Fatalf("合法的信不該報錯：%v", err)
	}
	for name, m := range map[string]Message{
		"沒有寄件者": {To: ok.To, Subject: "s", Text: "t"},
		"沒有收件者": {From: ok.From, Subject: "s", Text: "t"},
		"沒有主旨":  {From: ok.From, To: ok.To, Subject: " ", Text: "t"},
		"沒有內容":  {From: ok.From, To: ok.To, Subject: "s"},
	} {
		if err := m.validate(); !errors.Is(err, ErrInvalidMessage) {
			t.Errorf("%s：預期 ErrInvalidMessage，得到 %v", name, err)
		}
	}
}

func TestBuildSESInput(t *testing.T) {
	in := buildSESInput(Message{From: "a@example.com", To: []string{"b@example.com"}, Subject: "主旨", HTML: "<p>hi</p>"}, "")
	if in.ConfigurationSetName != nil {
		t.Error("沒設 configuration set 時不該帶")
	}
	simple := in.Content.Simple
	if *simple.Subject.Charset != "UTF-8" || simple.Body.Text != nil || *simple.Body.Html.Data != "<p>hi</p>" {
		t.Errorf("內容組錯：%+v", simple)
	}
	if in = buildSESInput(Message{From: "a", To: []string{"b"}, Subject: "s", Text: "t"}, "neko"); *in.ConfigurationSetName != "neko" {
		t.Error("有設 configuration set 時要帶上")
	}
}
