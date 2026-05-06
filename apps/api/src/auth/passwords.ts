import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id is the OWASP-recommended default. We use the @node-rs binding (Rust-native, no node-gyp)
 * with default parameters from the binding's `hash()`: m=19456 KiB, t=2, p=1.
 *
 * If params ever change, re-verifying old hashes still works — argon2 self-describes the cost
 * params in the encoded string. To migrate users to stronger params, rehash on next login.
 */

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext);
}

export async function verifyPassword(encodedHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(encodedHash, plaintext);
  } catch {
    // Malformed hash, mismatched algorithm, etc. → treat as failed verification.
    return false;
  }
}
