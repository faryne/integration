package parameter

import (
	"errors"
	"strconv"
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

// Bool 只接受 strconv.ParseBool 認得的值（1/0、true/false、t/f…），避免 -notify 0 被當成有帶值而變 true
func Bool(value string) error {
	if _, err := strconv.ParseBool(value); err != nil {
		return errors.New("must be true/false or 1/0")
	}
	return nil
}
