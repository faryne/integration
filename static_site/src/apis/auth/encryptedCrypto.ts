const nonceLength = 12;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

function base64UrlToBytes(input: string) {
  const cleanInput = input.trim();
  if (!cleanInput || !base64UrlPattern.test(cleanInput)) {
    throw new Error("payload is not a valid base64url string");
  }

  const normalized = cleanInput.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  if (normalized.length % 4 === 1) {
    throw new Error("payload base64url length is invalid");
  }

  const padded = normalized + "=".repeat(paddingLength);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(input: Uint8Array) {
  let binary = "";
  input.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function importEncryptKey(encryptKey: string) {
  const rawKey = base64UrlToBytes(encryptKey);
  if (rawKey.byteLength !== 32) {
    throw new Error("encrypt_key must decode to 32 bytes");
  }

  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptPayload(encryptKey: string, plaintext: string) {
  const key = await importEncryptKey(encryptKey);
  const nonce = crypto.getRandomValues(new Uint8Array(nonceLength));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );

  const payload = new Uint8Array(nonce.byteLength + ciphertext.byteLength);
  payload.set(nonce, 0);
  payload.set(ciphertext, nonce.byteLength);
  return bytesToBase64Url(payload);
}

export async function decryptPayload(encryptKey: string, encrypted: string) {
  const key = await importEncryptKey(encryptKey);
  const payload = base64UrlToBytes(encrypted);
  if (payload.byteLength <= nonceLength) {
    throw new Error("encrypted payload is too short");
  }

  const nonce = payload.slice(0, nonceLength);
  const ciphertext = payload.slice(nonceLength);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}
