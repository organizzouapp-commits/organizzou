// Browser cryptography of the Cofre (WebCrypto only, no dependencies). Pure: it never touches storage, the network, the DOM or the console.
//
//  - The master password becomes a 256-bit AES-GCM key with PBKDF2-HMAC-SHA-256, 600 000 iterations (OWASP's current minimum for this
//    function) and a random 16-byte salt that belongs to the vault. The key is not extractable.
//  - Every encryption uses a fresh random 96-bit IV. The "additional data" binds a ciphertext to what it is (item id, file id, the
//    verification blob), so a record cannot be moved onto another one without failing authentication.
//  - The master password and the key are never stored: the caller keeps the key in memory only while the vault is unlocked.

export const KDF_PARAMS = { name: "PBKDF2", hash: "SHA-256", iterations: 600_000, saltBytes: 16 } as const
/** A stored vault is refused when it asks for fewer iterations than this (a tampered meta could try to weaken the key). */
export const MIN_KDF_ITERATIONS = 600_000
export const IV_BYTES = 12

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type KdfMeta = { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string }
/** Base64 of the IV and of the ciphertext (which ends with the 16-byte GCM tag). */
export type Cipher = { iv: string; ct: string }

export class WrongPasswordError extends Error {
  constructor() {
    super("wrong-password")
    this.name = "WrongPasswordError"
  }
}
export class DecryptError extends Error {
  constructor() {
    super("decrypt-failed")
    this.name = "DecryptError"
  }
}

// ------------------------------------------------------------------ base64

export function toBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length))

// ------------------------------------------------------------------ key

/** The AES-GCM key of a password, a salt and an iteration count. Not extractable. */
export async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
}

/** A new random salt and the key it gives for this password, with the parameters to store next to the vault. */
export async function newKey(password: string, iterations: number = KDF_PARAMS.iterations): Promise<{ key: CryptoKey; kdf: KdfMeta }> {
  const salt = randomBytes(KDF_PARAMS.saltBytes)
  return { key: await deriveKey(password, salt, iterations), kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: toBase64(salt) } }
}

/** The key of a stored vault for a password; refuses parameters weaker than the minimum. */
export async function keyFromMeta(password: string, kdf: KdfMeta): Promise<CryptoKey> {
  if (kdf.name !== "PBKDF2" || kdf.hash !== "SHA-256" || !Number.isInteger(kdf.iterations) || kdf.iterations < MIN_KDF_ITERATIONS) throw new DecryptError()
  return deriveKey(password, fromBase64(kdf.salt), kdf.iterations)
}

// ------------------------------------------------------------------ encrypt / decrypt

/** Encrypts bytes with a fresh IV. `aad` is authenticated, not hidden: use it to say what the record is ("item:<id>"). */
export async function encryptBytes(key: CryptoKey, data: Uint8Array, aad: string): Promise<{ iv: Uint8Array; ct: Uint8Array }> {
  const iv = randomBytes(IV_BYTES)
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: encoder.encode(aad) as BufferSource }, key, data as BufferSource)
  return { iv, ct: new Uint8Array(ct) }
}

/** Decrypts and authenticates; any change to the ciphertext, the IV, the key or the aad throws DecryptError. */
export async function decryptBytes(key: CryptoKey, iv: Uint8Array, ct: Uint8Array, aad: string): Promise<Uint8Array> {
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: encoder.encode(aad) as BufferSource }, key, ct as BufferSource)
    return new Uint8Array(plain)
  } catch {
    throw new DecryptError()
  }
}

export async function encryptJson(key: CryptoKey, value: unknown, aad: string): Promise<Cipher> {
  const { iv, ct } = await encryptBytes(key, encoder.encode(JSON.stringify(value)), aad)
  return { iv: toBase64(iv), ct: toBase64(ct) }
}

export async function decryptJson<T>(key: CryptoKey, cipher: Cipher, aad: string): Promise<T> {
  let iv: Uint8Array
  let ct: Uint8Array
  try {
    iv = fromBase64(cipher.iv)
    ct = fromBase64(cipher.ct)
  } catch {
    throw new DecryptError()
  }
  const plain = await decryptBytes(key, iv, ct, aad)
  try {
    return JSON.parse(decoder.decode(plain)) as T
  } catch {
    throw new DecryptError()
  }
}

// ------------------------------------------------------------------ verification blob

const CHECK_TEXT = "organizzou-vault-check"
export const CHECK_AAD = "check"

/** What is stored to tell a right password from a wrong one without keeping the password: a known text, encrypted. */
export const makeCheck = (key: CryptoKey) => encryptJson(key, CHECK_TEXT, CHECK_AAD)

/** True when the key opens the verification blob. */
export async function verifyCheck(key: CryptoKey, check: Cipher): Promise<boolean> {
  try {
    return (await decryptJson<string>(key, check, CHECK_AAD)) === CHECK_TEXT
  } catch {
    return false
  }
}
