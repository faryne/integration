package nico

import "testing"

func TestExtractSourceImageURL(t *testing.T) {
	tests := []struct {
		name string
		html string
		want string
	}{
		{
			name: "absolute",
			html: `<div class="illust_view_big" data-src="https://lohas.nicoseiga.jp/o/abc.jpg"></div>`,
			want: "https://lohas.nicoseiga.jp/o/abc.jpg",
		},
		{
			name: "protocol relative",
			html: `<div data-src="//lohas.nicoseiga.jp/o/abc.jpg"></div>`,
			want: "https://lohas.nicoseiga.jp/o/abc.jpg",
		},
		{
			name: "path",
			html: `<div data-src="/o/abc.jpg"></div>`,
			want: "https://lohas.nicoseiga.jp/o/abc.jpg",
		},
		{
			name: "missing",
			html: `<html></html>`,
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := extractSourceImageURL(tt.html); got != tt.want {
				t.Fatalf("extractSourceImageURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestExtractLoginFormAction(t *testing.T) {
	tests := []struct {
		name string
		html string
		want string
	}{
		{
			name: "action before id",
			html: `<form action="/login/redirector?site=seiga&amp;next_url=%2Fimage%2Fsource%2F11805121" method="POST" id="login_form">`,
			want: "https://account.nicovideo.jp/login/redirector?site=seiga&next_url=%2Fimage%2Fsource%2F11805121",
		},
		{
			name: "id before action",
			html: `<form id="login_form" method="POST" action="/login/redirector?site=seiga">`,
			want: "https://account.nicovideo.jp/login/redirector?site=seiga",
		},
		{
			name: "absolute",
			html: `<form id="login_form" action="https://account.nicovideo.jp/login/redirector?site=seiga">`,
			want: "https://account.nicovideo.jp/login/redirector?site=seiga",
		},
		{
			name: "missing",
			html: `<html></html>`,
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := extractLoginFormAction(tt.html); got != tt.want {
				t.Fatalf("extractLoginFormAction() = %q, want %q", got, tt.want)
			}
		})
	}
}
