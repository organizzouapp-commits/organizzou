import { describe, expect, it } from "vitest"

import { avatarPath, checkAvatarFile, cropRect, isImageDataUrl, isOwnAvatarPath, MAX_INPUT_BYTES } from "./avatar"

describe("checkAvatarFile", () => {
  it("accepts images up to 5 MB", () => {
    expect(checkAvatarFile({ type: "image/jpeg", size: 1000 }).ok).toBe(true)
    expect(checkAvatarFile({ type: "image/png", size: MAX_INPUT_BYTES }).ok).toBe(true)
  })
  it("rejects other files, big files and empty files", () => {
    expect(checkAvatarFile({ type: "application/pdf", size: 1000 }).ok).toBe(false)
    expect(checkAvatarFile({ type: "image/png", size: MAX_INPUT_BYTES + 1 }).ok).toBe(false)
    expect(checkAvatarFile({ type: "image/png", size: 0 }).ok).toBe(false)
  })
})

describe("cropRect", () => {
  it("takes the centered square of a landscape picture", () => {
    expect(cropRect(1000, 500)).toEqual({ sx: 250, sy: 0, size: 500 })
  })
  it("zooms in and stays inside the picture", () => {
    const zoomed = cropRect(1000, 500, 2)
    expect(zoomed.size).toBe(250)
    expect(zoomed).toEqual({ sx: 375, sy: 125, size: 250 })
    const edge = cropRect(1000, 500, 2, 5, -5)
    expect(edge.sx + edge.size).toBeLessThanOrEqual(1000)
    expect(edge.sy).toBeGreaterThanOrEqual(0)
  })
  it("caps the zoom", () => {
    expect(cropRect(400, 400, 99).size).toBe(100)
    expect(cropRect(400, 400, 0).size).toBe(400)
  })
})

describe("paths and data urls", () => {
  it("keeps the photo inside the user's folder", () => {
    expect(avatarPath("u1")).toBe("u1/avatar.webp")
    expect(isOwnAvatarPath("u1/avatar.webp", "u1")).toBe(true)
    expect(isOwnAvatarPath("u2/avatar.webp", "u1")).toBe(false)
    expect(isOwnAvatarPath("u1/../u2/avatar.webp", "u1")).toBe(false)
  })
  it("accepts only image data urls", () => {
    expect(isImageDataUrl("data:image/webp;base64,AAAA")).toBe(true)
    expect(isImageDataUrl("data:text/html;base64,AAAA")).toBe(false)
    expect(isImageDataUrl("javascript:alert(1)")).toBe(false)
  })
})

describe("focusAfterDrag", () => {
  it("moves the crop opposite to the drag and clamps", async () => {
    const { focusAfterDrag } = await import("./avatar")
    // 1000x500 picture, zoom 1: the crop is 500 wide with 250 of slack each side; preview 250px => 2 picture px per preview px.
    expect(focusAfterDrag(1000, 500, 1, { x: 0, y: 0 }, 0, 0, 250)).toEqual({ x: 0, y: 0 })
    expect(focusAfterDrag(1000, 500, 1, { x: 0, y: 0 }, 62.5, 0, 250).x).toBeCloseTo(-0.5)
    expect(focusAfterDrag(1000, 500, 1, { x: 0, y: 0 }, -9999, 0, 250).x).toBe(1)
    expect(focusAfterDrag(1000, 500, 1, { x: 0, y: 0 }, 0, 40, 250).y).toBe(0)
  })
})
