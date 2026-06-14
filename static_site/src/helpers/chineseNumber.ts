const chineseDigits = [
  "零",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
];
const smallUnits = ["", "十", "百", "千"];
const groupUnits = ["", "萬", "億", "兆", "京"];
const financialChineseDigits = [
  "零",
  "壹",
  "貳",
  "參",
  "肆",
  "伍",
  "陸",
  "柒",
  "捌",
  "玖",
];
const financialSmallUnits = ["", "拾", "佰", "仟"];

function fourDigitsToChinese(
  value: number,
  digits: string[] = chineseDigits,
  units: string[] = smallUnits,
) {
  let result = "";
  let pendingZero = false;
  for (let position = 3; position >= 0; position -= 1) {
    const divisor = 10 ** position;
    const digit = Math.floor(value / divisor) % 10;
    if (digit === 0) {
      if (result) pendingZero = true;
      continue;
    }
    if (pendingZero) {
      result += "零";
      pendingZero = false;
    }
    result += digits[digit] + units[position];
  }
  return result;
}

export function integerToChinese(value: number) {
  return integerToChineseWithDigits(
    value,
    chineseDigits,
    smallUnits,
    (result) => (result.startsWith("一十") ? result.slice(1) : result),
  );
}

export function integerToFinancialChinese(value: number) {
  return integerToChineseWithDigits(
    value,
    financialChineseDigits,
    financialSmallUnits,
  );
}

function integerToChineseWithDigits(
  value: number,
  digits: string[],
  units: string[],
  normalize: (result: string) => string = (result) => result,
) {
  const integer = Math.round(Math.abs(value));
  if (integer === 0) return "零";

  const groups: number[] = [];
  for (
    let remaining = integer;
    remaining > 0;
    remaining = Math.floor(remaining / 10000)
  ) {
    groups.push(remaining % 10000);
  }

  let result = "";
  let pendingZero = false;
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (group === 0) {
      if (result) pendingZero = true;
      continue;
    }
    if (result && (pendingZero || group < 1000)) result += "零";
    result +=
      fourDigitsToChinese(group, digits, units) + (groupUnits[index] ?? "");
    pendingZero = false;
  }
  const normalized = normalize(result);
  return value < 0 ? `負${normalized}` : normalized;
}
