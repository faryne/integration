package mediaworker

import (
	"encoding/json"
	"errors"

	"github.com/zalando/go-keyring"
)

const keyringService = "steamloom-writer-media-worker"

type secretVault interface {
	load(string) (map[string]string, error)
	save(string, map[string]string) error
	delete(string) error
}

type keyringVault struct{}

func (keyringVault) load(id string) (map[string]string, error) {
	raw, err := keyring.Get(keyringService, id)
	if errors.Is(err, keyring.ErrNotFound) {
		return map[string]string{}, nil
	}
	if err != nil {
		return nil, err
	}
	var values map[string]string
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return nil, err
	}
	return values, nil
}

func (keyringVault) save(id string, values map[string]string) error {
	if len(values) == 0 {
		return keyringVault{}.delete(id)
	}
	raw, err := json.Marshal(values)
	if err != nil {
		return err
	}
	return keyring.Set(keyringService, id, string(raw))
}

func (keyringVault) delete(id string) error {
	if err := keyring.Delete(keyringService, id); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return err
	}
	return nil
}
