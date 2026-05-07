import { createRequire } from 'module';

// libsodium-wrappers is CommonJS; createRequire lets us load it from ESM.
const _require = createRequire(import.meta.url);
const _sodium = _require('libsodium-wrappers') as typeof import('libsodium-wrappers');

let _ready = false;

async function getSodium(): Promise<typeof _sodium> {
  if (!_ready) {
    await _sodium.ready;
    _ready = true;
  }
  return _sodium;
}

/**
 * Encrypt a developer's LLM API key using a libsodium sealed box.
 * Only the holder of LLM_KEY_ENCRYPTION_PRIVATE can decrypt.
 * The plaintext key never touches the DB or logs.
 */
export async function encryptApiKey(plaintext: string): Promise<Buffer> {
  const sodium = await getSodium();
  const pub64 = process.env.LLM_KEY_ENCRYPTION_PUBLIC;
  if (!pub64) throw new Error('LLM_KEY_ENCRYPTION_PUBLIC env var not set');
  const publicKey = sodium.from_base64(pub64, sodium.base64_variants.ORIGINAL);
  const ciphertext = sodium.crypto_box_seal(Buffer.from(plaintext, 'utf8'), publicKey);
  return Buffer.from(ciphertext);
}

/**
 * Decrypt a sealed box created by encryptApiKey.
 */
export async function decryptApiKey(ciphertext: Buffer): Promise<string> {
  const sodium = await getSodium();
  const pub64 = process.env.LLM_KEY_ENCRYPTION_PUBLIC;
  const priv64 = process.env.LLM_KEY_ENCRYPTION_PRIVATE;
  if (!pub64 || !priv64) throw new Error('LLM_KEY_ENCRYPTION_PUBLIC / _PRIVATE env vars not set');
  const publicKey = sodium.from_base64(pub64, sodium.base64_variants.ORIGINAL);
  const privateKey = sodium.from_base64(priv64, sodium.base64_variants.ORIGINAL);
  const decrypted = sodium.crypto_box_seal_open(new Uint8Array(ciphertext), publicKey, privateKey);
  return sodium.to_string(decrypted);
}

/** Last-4 mask for display (never return the real key). */
export function maskApiKey(plaintext: string): string {
  return '***' + plaintext.slice(-4);
}
