package mediaworker

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

type fileStore struct{ path string }

func (s fileStore) load() ([]storedWorker, error) {
	raw, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return []storedWorker{}, nil
	}
	if err != nil {
		return nil, err
	}
	var data storedFile
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, err
	}
	if data.Workers == nil {
		data.Workers = []storedWorker{}
	}
	return data.Workers, nil
}

func (s fileStore) save(workers []storedWorker) error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(storedFile{Workers: workers}, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(s.path), "workers-*.json")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(raw); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, s.path)
}
