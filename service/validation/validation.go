package validation

import (
	"net/url"
	"strings"

	"github.com/go-playground/validator/v10"
)

type StructValidator struct {
	validate *validator.Validate
}

func NewStructValidator() *StructValidator {
	v := validator.New()
	_ = v.RegisterValidation("http_url", validateHTTPURL)

	return &StructValidator{
		validate: v,
	}
}

func (v *StructValidator) Validate(out any) error {
	return v.validate.Struct(out)
}

func validateHTTPURL(fl validator.FieldLevel) bool {
	parsed, err := url.ParseRequestURI(strings.TrimSpace(fl.Field().String()))
	if err != nil {
		return false
	}

	return (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}
