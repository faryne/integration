package parameter

import (
	"errors"
	"time"
)

func YearMonth(value string) error {
	if _, err := time.Parse("2006-01", value); err != nil {
		return errors.New("must use YYYY-MM format")
	}
	return nil
}

func Date(value string) error {
	if _, err := time.Parse(time.DateOnly, value); err != nil {
		return errors.New("must use YYYY-MM-DD format")
	}
	return nil
}
