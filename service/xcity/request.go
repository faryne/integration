package xcity

import "net/http"

func sendRequest(uri string) (*http.Response, error) {
	resp, err := http.DefaultClient.Get(uri)
	if err != nil {
		return nil, err
	}
	return resp, nil
}
