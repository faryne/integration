import fs from "node:fs";
import path from "node:path";

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

const value = process.argv[2];

if (!value) {
  console.error('Usage: node scripts/encode-contact.mjs "value to encode"');
  process.exit(1);
}

const env = readEnv();
const key = process.env.VITE_SECRET_KEY || env.VITE_SECRET_KEY || "faryne.dev";

console.log(encryptContact(value, key));
