package parameter

import "flag"

type Validator func(string) error

type Param struct {
	value       string
	description string
	validate    Validator
}

func New(description string, validate Validator) *Param {
	return &Param{
		description: description,
		validate:    validate,
	}
}

func (p *Param) String() string {
	return p.value
}

func (p *Param) Set(value string) error {
	if err := p.validateValue(value); err != nil {
		return err
	}
	p.value = value
	return nil
}

func (p *Param) Validate() error {
	if p.value == "" {
		return nil
	}
	return p.validateValue(p.value)
}

func (p *Param) Value() string {
	return p.value
}

func (p *Param) Description() string {
	return p.description
}

func (p *Param) validateValue(value string) error {
	if p.validate == nil {
		return nil
	}
	return p.validate(value)
}

type Registry map[string]*Param

func (r Registry) Register(flags *flag.FlagSet) {
	for name, param := range r {
		flags.Var(param, name, param.Description())
	}
}

func (r Registry) Value(name string) string {
	param, ok := r[name]
	if !ok {
		return ""
	}
	return param.Value()
}
