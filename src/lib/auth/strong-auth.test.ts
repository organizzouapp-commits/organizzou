import { describe, expect, it } from "vitest"

import { requiresSecondStep, signStrongProof, verifyStrongProof } from "./strong-auth"

const SECRET = "x".repeat(40)
const now = 1_800_000_000_000

describe("strong proof", () => {
  it("verifies for the same user and session", async () => {
    const proof = await signStrongProof(SECRET, "u1", "s1", now)
    expect(await verifyStrongProof(SECRET, proof, "u1", "s1", now + 1000)).toBe(true)
  })
  it("is useless for another user, another session or another secret", async () => {
    const proof = await signStrongProof(SECRET, "u1", "s1", now)
    expect(await verifyStrongProof(SECRET, proof, "u2", "s1", now)).toBe(false)
    expect(await verifyStrongProof(SECRET, proof, "u1", "s2", now)).toBe(false)
    expect(await verifyStrongProof("y".repeat(40), proof, "u1", "s1", now)).toBe(false)
  })
  it("expires and refuses tampering and missing values", async () => {
    const proof = await signStrongProof(SECRET, "u1", "s1", now, 60)
    expect(await verifyStrongProof(SECRET, proof, "u1", "s1", now + 61_000)).toBe(false)
    const [exp, sig] = proof.split(".")
    expect(await verifyStrongProof(SECRET, `${Number(exp) + 1000}.${sig}`, "u1", "s1", now)).toBe(false)
    expect(await verifyStrongProof(SECRET, "garbage", "u1", "s1", now)).toBe(false)
    expect(await verifyStrongProof(SECRET, undefined, "u1", "s1", now)).toBe(false)
    expect(await verifyStrongProof(null, proof, "u1", "s1", now)).toBe(false)
  })
})

describe("requiresSecondStep", () => {
  it("reads the server-set flag only", () => {
    expect(requiresSecondStep({ app_metadata: { two_factor: true } })).toBe(true)
    expect(requiresSecondStep({ app_metadata: { two_factor: "true" } })).toBe(false)
    expect(requiresSecondStep({ app_metadata: {} })).toBe(false)
    expect(requiresSecondStep(null)).toBe(false)
  })
})
