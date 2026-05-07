/**
 * One-time key generation for LLM API key encryption.
 * Run once and add the output to your .env (local) / Fly secrets (production).
 *
 * Usage: pnpm --filter api tsx scripts/generate-llm-keys.ts
 */
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const sodium = _require('libsodium-wrappers') as typeof import('libsodium-wrappers');

await sodium.ready;
const kp = sodium.crypto_box_keypair();
console.log('Add these to your .env / fly secrets:');
console.log('LLM_KEY_ENCRYPTION_PUBLIC=' + sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL));
console.log('LLM_KEY_ENCRYPTION_PRIVATE=' + sodium.to_base64(kp.privateKey, sodium.base64_variants.ORIGINAL));
