package helper

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

// chineseToNumber 保持不變，負責處理中文數字轉整數
func chineseToNumber(src string) int {
	digitMap := map[rune]int{
		'零': 0, '〇': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
		'壹': 1, '貳': 2, '參': 3, '肆': 4, '伍': 5, '陸': 6, '柒': 7, '捌': 8, '玖': 9,
	}
	unitMap := map[rune]int{'十': 10, '拾': 10, '百': 100, '佰': 100}

	runes := []rune(src)
	hasUnit := false
	for _, r := range runes {
		if _, ok := unitMap[r]; ok {
			hasUnit = true
			break
		}
	}

	if !hasUnit {
		resStr := ""
		for _, r := range runes {
			if v, ok := digitMap[r]; ok {
				resStr += strconv.Itoa(v)
			} else if r >= '0' && r <= '9' {
				resStr += string(r)
			}
		}
		val, _ := strconv.Atoi(resStr)
		return val
	}

	total, temp := 0, 0
	for i, char := range runes {
		if val, isDigit := digitMap[char]; isDigit {
			temp = val
			if i == len(runes)-1 {
				total += temp
			}
		} else if unit, isUnit := unitMap[char]; isUnit {
			if temp == 0 && unit == 10 {
				temp = 1
			}
			total += temp * unit
			temp = 0
		}
	}
	return total
}

// ROCFullDateToAD 支援 民前/民國 的全能轉換器
func ROCFullDateToAD(input string, format string) (string, error) {
	// 判斷是否為民前
	isBeforeROC := regexp.MustCompile(`民前`).MatchString(input)

	// 抓取數字區塊（包含中文與阿拉伯數字）
	re := regexp.MustCompile(`[零〇一二三四五六七八九壹貳參肆伍陸柒捌玖拾十佰百\d]+`)
	matches := re.FindAllString(input, -1)

	if len(matches) < 3 {
		return "", fmt.Errorf("格式無法解析: %s", input)
	}

	y := chineseToNumber(matches[0])
	m := chineseToNumber(matches[1])
	d := chineseToNumber(matches[2])

	var adYear int
	if isBeforeROC {
		// 民前 1 年 = 西元 1911
		// 民前 2 年 = 西元 1910
		adYear = 1911 - y + 1
	} else {
		// 民國 1 年 = 西元 1912
		adYear = 1911 + y
	}

	t := time.Date(adYear, time.Month(m), d, 0, 0, 0, 0, time.Local)
	if t.Month() != time.Month(m) || t.Day() != d {
		return "", fmt.Errorf("無效日期: %d-%d-%d", adYear, m, d)
	}

	return t.Format(format), nil
}
