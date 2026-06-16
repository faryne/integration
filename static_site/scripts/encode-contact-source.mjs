import fs from "node:fs";
import path from "node:path";

const sourceRoot = path.resolve(process.cwd(), "src");
const targetExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const callPattern =
  /\bce\(\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)\s*\)/g;

function readEnv() {
  const envPath = path.resolve(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const [key, ...valueParts] = line.split("=");
        const rawValue = valueParts.join("=");
        const value = rawValue.replace(/^['"]|['"]$/g, "");

        return [key, value];
      }),
  );
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encryptContact(value, key) {
  const input = new TextEncoder().encode(value);
  const keyBytes = new TextEncoder().encode(key || "faryne.dev");
  const encrypted = input.map((byte, index) => byte ^ keyBytes[index % keyBytes.length]);

  return `v1.${toBase64Url(encrypted)}`;
}

function parseStringLiteral(value) {
  return Function(`"use strict"; return (${value});`)();
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(filePath);
    }

    return targetExtensions.has(path.extname(entry.name)) ? [filePath] : [];
  });
}

const env = readEnv();
const key = process.env.VITE_SECRET_KEY || env.VITE_SECRET_KEY || "faryne.dev";
let changedCount = 0;

for (const filePath of walk(sourceRoot)) {
  const source = fs.readFileSync(filePath, "utf8");
  const transformed = source.replace(callPattern, (match) => {
    const literal = match.slice(match.indexOf("(") + 1, -1).trim();
    const value = parseStringLiteral(literal);

    if (typeof value !== "string" || value.startsWith("v1.")) {
      return match;
    }

    changedCount += 1;
    return `ce(${JSON.stringify(encryptContact(value, key))})`;
  });

  if (transformed !== source) {
    fs.writeFileSync(filePath, transformed);
  }
}

if (changedCount > 0) {
  console.log(`Encoded ${changedCount} contact string(s).`);
}
