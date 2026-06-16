function keyBytes() {
  const key = import.meta.env.VITE_SECRET_KEY;

  if (!key) {
    throw new Error("VITE_SECRET_KEY is required to decode encoded contact strings.");
  }

  return new TextEncoder().encode(key);
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export function ce(payload: string): string {
  if (!payload.startsWith("v1.")) {
    return payload;
  }

  const data = fromBase64Url(payload.slice(3));
  const key = keyBytes();
  const decoded = data.map((byte, index) => byte ^ key[index % key.length]);

  return new TextDecoder().decode(decoded);
}
