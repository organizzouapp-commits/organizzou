import { describe, expect, it } from "vitest"

import { DecryptError, IV_BYTES, KDF_PARAMS, MIN_KDF_ITERATIONS, decryptBytes, decryptJson, encryptBytes, encryptJson, fromBase64, keyFromMeta, makeCheck, newKey, toBase64, verifyCheck } from "./crypto"

// PBKDF2 at 600 000 iterations is deliberately slow: keep the number of derivations small.
const PASSWORD = "uma senha mestra bem longa 2026!"
const keyPromise = newKey(PASSWORD)

describe("key derivation parameters", () => {
  it("uses PBKDF2-SHA-256 with at least 600 000 iterations and a random 16-byte salt per vault", async () => {
    expect(KDF_PARAMS).toMatchObject({ name: "PBKDF2", hash: "SHA-256", saltBytes: 16 })
    expect(KDF_PARAMS.iterations).toBeGreaterThanOrEqual(600_000)
    const { kdf } = await keyPromise
    expect(kdf).toMatchObject({ name: "PBKDF2", hash: "SHA-256", iterations: KDF_PARAMS.iterations })
    expect(fromBase64(kdf.salt)).toHaveLength(16)
    // A second vault gets another salt (the iteration count is lowered here only to keep the test quick).
    const other = await newKey(PASSWORD, MIN_KDF_ITERATIONS)
    expect(other.kdf.salt).not.toBe(kdf.salt)
  })

  it("refuses a stored vault that asks for fewer iterations than the minimum", async () => {
    const { kdf } = await keyPromise
    await expect(keyFromMeta(PASSWORD, { ...kdf, iterations: 1000 })).rejects.toBeInstanceOf(DecryptError)
    await expect(keyFromMeta(PASSWORD, { ...kdf, hash: "SHA-1" as unknown as "SHA-256" })).rejects.toBeInstanceOf(DecryptError)
  })

  it("gives a key that is not extractable", async () => {
    const { key } = await keyPromise
    expect(key.extractable).toBe(false)
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toBeTruthy()
  })
})

describe("encrypt and decrypt", () => {
  it("round-trips JSON and bytes", async () => {
    const { key } = await keyPromise
    const value = { name: "Banco", password: "s3gredo-ç ã é", list: [1, 2, 3] }
    const cipher = await encryptJson(key, value, "item:1")
    expect(await decryptJson(key, cipher, "item:1")).toEqual(value)
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252])
    const { iv, ct } = await encryptBytes(key, bytes, "file:1")
    expect(Array.from(await decryptBytes(key, iv, ct, "file:1"))).toEqual(Array.from(bytes))
  })

  it("does not leave the plaintext in the ciphertext", async () => {
    const { key } = await keyPromise
    const cipher = await encryptJson(key, { password: "SEGREDO-MUITO-ESPECIAL" }, "item:1")
    expect(atob(cipher.ct)).not.toContain("SEGREDO")
  })

  it("uses a fresh random IV every time, so the same text never gives the same ciphertext", async () => {
    const { key } = await keyPromise
    const a = await encryptJson(key, "igual", "item:1")
    const b = await encryptJson(key, "igual", "item:1")
    expect(fromBase64(a.iv)).toHaveLength(IV_BYTES)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ct).not.toBe(b.ct)
    const ivs = new Set<string>()
    for (let i = 0; i < 20; i++) ivs.add((await encryptJson(key, i, "x")).iv)
    expect(ivs.size).toBe(20)
  })

  it("fails with a wrong password's key", async () => {
    const { key, kdf } = await keyPromise
    const cipher = await encryptJson(key, "segredo", "item:1")
    const wrong = await keyFromMeta("outra senha mestra errada 1!", kdf)
    await expect(decryptJson(wrong, cipher, "item:1")).rejects.toBeInstanceOf(DecryptError)
  })

  it("fails when the ciphertext is tampered with (GCM authentication)", async () => {
    const { key } = await keyPromise
    const cipher = await encryptJson(key, "segredo", "item:1")
    const bytes = fromBase64(cipher.ct)
    bytes[0] ^= 0x01
    await expect(decryptJson(key, { ...cipher, ct: toBase64(bytes) }, "item:1")).rejects.toBeInstanceOf(DecryptError)
    const tag = fromBase64(cipher.ct)
    tag[tag.length - 1] ^= 0xff
    await expect(decryptJson(key, { ...cipher, ct: toBase64(tag) }, "item:1")).rejects.toBeInstanceOf(DecryptError)
    const iv = fromBase64(cipher.iv)
    iv[0] ^= 0x01
    await expect(decryptJson(key, { ...cipher, iv: toBase64(iv) }, "item:1")).rejects.toBeInstanceOf(DecryptError)
  })

  it("fails when a ciphertext is moved onto another record (the aad binds it)", async () => {
    const { key } = await keyPromise
    const cipher = await encryptJson(key, "segredo", "item:1")
    await expect(decryptJson(key, cipher, "item:2")).rejects.toBeInstanceOf(DecryptError)
  })

  it("rejects malformed input instead of returning garbage", async () => {
    const { key } = await keyPromise
    await expect(decryptJson(key, { iv: "%%%", ct: "!!!" }, "x")).rejects.toBeInstanceOf(DecryptError)
    await expect(decryptJson(key, { iv: toBase64(new Uint8Array(12)), ct: toBase64(new Uint8Array(4)) }, "x")).rejects.toBeInstanceOf(DecryptError)
  })
})

describe("verification blob", () => {
  it("is true for the right key and false for another one or a damaged blob", async () => {
    const { key, kdf } = await keyPromise
    const check = await makeCheck(key)
    expect(await verifyCheck(key, check)).toBe(true)
    expect(await verifyCheck(await keyFromMeta("senha errada errada 99!", kdf), check)).toBe(false)
    expect(await verifyCheck(key, { ...check, ct: toBase64(new Uint8Array(32)) })).toBe(false)
  })
})
