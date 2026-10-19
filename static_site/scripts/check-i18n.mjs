// SteamLoom 前端 i18n 檢查（規則見 repo 根目錄 README「前端多語系（i18n）規則」）：
// 1. 各語系的 key 集合要跟 zh-TW 完全一致
// 2. 同一個 key 在五個語系的佔位符（{{var}}、<tag>）要一致
// 3. 程式碼裡引用的 key 要存在（動態 key 只檢查 ${ 之前的前綴）
// 有任何問題就列出並以非零代碼結束。用法：pnpm check:i18n
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const i18nDir = join(root, "src/i18n");
const BASE = "zh-TW";
const LOCALES = ["zh-CN", "en", "ja", "ko"];
const FILES = ["web", "writer", "moderation"];
// 「以 某筆名 回覆」語序各語言不同，verb 會在前綴或後綴之間調換，佔位符刻意不一致
const PLACEHOLDER_EXCEPTIONS = [
  "web.social.speakAs.prefix",
  "web.social.speakAs.suffix",
];

// 巢狀物件攤平成「a.b.c」；陣列也展開成 index（例如 web.public.copies.0.title）
function flatten(value, prefix, out = {}) {
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value))
      flatten(child, `${prefix}.${key}`, out);
  } else {
    out[prefix] = String(value);
  }
  return out;
}

const loadLocale = (locale) =>
  Object.assign(
    {},
    ...FILES.map((file) =>
      flatten(
        JSON.parse(readFileSync(join(i18nDir, locale, `${file}.json`), "utf8")),
        file,
      ),
    ),
  );

// {{var}} 與 <tag>；<Agent> 是文案裡的一般文字（「/<Agent 名稱>」），不算標籤
const placeholders = (text) =>
  [
    ...new Set([
      ...[...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => `{{${m[1]}}}`),
      ...[...text.matchAll(/<(\w+)>/g)]
        .filter((m) => m[1] !== "Agent")
        .map((m) => `<${m[1]}>`),
    ]),
  ]
    .sort()
    .join(" ");

const problems = [];
const base = loadLocale(BASE);
const baseKeys = new Set(Object.keys(base));

// 1、2：key 集合與佔位符
for (const locale of LOCALES) {
  const values = loadLocale(locale);
  for (const key of baseKeys) {
    if (!(key in values)) problems.push(`[${locale}] 缺少 key：${key}`);
    else if (
      !PLACEHOLDER_EXCEPTIONS.includes(key) &&
      placeholders(base[key]) !== placeholders(values[key])
    )
      problems.push(
        `[${locale}] 佔位符不一致：${key}（${BASE}「${placeholders(base[key])}」／${locale}「${placeholders(values[key])}」）`,
      );
  }
  for (const key of Object.keys(values))
    if (!baseKeys.has(key))
      problems.push(`[${locale}] 多出 zh-TW 沒有的 key：${key}`);
}

// 3：程式碼引用。writer: namespace 寫法對應到 writer.json 的同一組 key
const keyExists = (key) => {
  const normalized = key.replace(/^writer:/, "writer.");
  return (
    baseKeys.has(normalized) ||
    [...baseKeys].some((k) => k.startsWith(`${normalized}.`))
  );
};
const prefixExists = (prefix) => {
  const normalized = prefix.replace(/^writer:/, "writer.");
  return [...baseKeys].some((k) => k.startsWith(normalized));
};

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.tsx?$/.test(entry.name)) yield path;
  }
}

// 引號開頭的 key 字面量；後面緊接 ${ 的是動態 key。mcpClientSetup.ts 這類資料檔存的字串 key 也會被掃到
const KEY_LITERAL =
  /["'`]((?:web|writer|moderation)[.:][A-Za-z0-9_.-]+)(\$\{)?/g;
for (const file of sourceFiles(join(root, "src"))) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(KEY_LITERAL)) {
    const [, key, dynamic] = match;
    const ok = dynamic ? prefixExists(key) : keyExists(key);
    if (!ok)
      problems.push(
        `[引用] ${relative(root, file)}：${dynamic ? `${key}\${…}` : key} 在 ${BASE} 找不到`,
      );
  }
}

if (problems.length > 0) {
  console.error(
    `i18n 檢查發現 ${problems.length} 個問題：\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(
  `i18n 檢查通過：${baseKeys.size} 個 key，${LOCALES.length + 1} 個語系一致，程式碼引用皆存在。`,
);
