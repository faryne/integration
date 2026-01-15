package opendata

import (
	ratesEntity "faryne.dev/model/entity/opendata/rates"
	ratesRepository "faryne.dev/repository/rates"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

func Rate(ctx fiber.Ctx) error {
	var req ratesEntity.RateRequest
	if err := ctx.Bind().Query(&req); err != nil {
		return output.BadRequest(err)
	}
	rates, err := ratesRepository.FetchRates(req)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rates)
}

func Banks(_ fiber.Ctx) error {
	return output.Success(map[string]string{
		"Mega":   "兆豐銀行",
		"BOT":    "台灣銀行",
		"esun":   "玉山銀行",
		"cathay": "國泰世華銀行",
		"land":   "土地銀行",
	})
}

func Currencies(ctx fiber.Ctx) error {
	return output.Success(map[string]string{
		"AUD": "澳元",
		"CAD": "加元",
		"CHF": "瑞士法郎",
		"CNY": "人民幣",
		"EUR": "歐元",
		"GBP": "英鎊",
		"HKD": "港元",
		"IDR": "印尼盧布",
		"JPY": "日圓",
		"KRW": "韓元",
		"MOP": "澳門元",
		"MXN": "墨西哥披索",
		"MYR": "馬來西亞令吉",
		"NZD": "紐元",
		"PHP": "菲律賓披索",
		"SEK": "瑞典克朗",
		"SGD": "新加坡元",
		"THB": "泰銖",
		"USD": "美元",
		"VND": "越南盾",
		"ZAR": "南非幣"})
}
