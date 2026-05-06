import { randomBytes } from 'node:crypto';

/**
 * Opaque random tokens for sessions and API keys. We deliberately avoid JWT here:
 *  - No need for distributed verification (single API server talking to its own DB).
 *  - Revocation is trivial — delete the row.
 *  - No risk of a rolled-back signing key invalidating live sessions.
 *
 * 32 random bytes → ~43 base64url chars → 256 bits of entropy. Way more than we need
 * but the storage/network cost is negligible.
 */

const SESSION_BYTES = 32;
const KEY_BYTES = 24;

export function generateSessionToken(): string {
  return randomBytes(SESSION_BYTES).toString('base64url');
}

/** API key with `ps_live_` prefix. The prefix lets us spot leaked keys in logs/code search. */
export function generateApiKey(): string {
  return `ps_live_${randomBytes(KEY_BYTES).toString('base64url')}`;
}
