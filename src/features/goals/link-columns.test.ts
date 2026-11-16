import { describe, expect, it } from "vitest"

import { linkFromRow, linkToColumns, mergeLinks } from "./link-columns"
import type { LinkedGoalMeta } from "./linked"

const saving: LinkedGoalMeta = { spec: { kind: "finance_saving", goalId: "7b9f1c2e-1111-4222-8333-444455556666" }, startDate: "2026-11-01", endDate: "2027-03-01" }
const weekly: LinkedGoalMeta = { spec: { kind: "workout_count", period: "week", count: 3 }, startDate: "2026-11-02", endDate: null }

describe("link columns", () => {
  it("a free goal has no link; a linked goal keeps the whole link in params and the target uuid in link_id", () => {
    expect(linkToColumns(undefined)).toEqual({ kind: "free", link_type: null, link_id: null, params: {}, start_date: null, end_date: null })
    const cols = linkToColumns(saving)
    expect(cols).toMatchObject({ kind: "linked", link_type: "finance_saving", link_id: "7b9f1c2e-1111-4222-8333-444455556666", start_date: "2026-11-01", end_date: "2027-03-01" })
    expect(linkToColumns(weekly).link_id).toBeNull()
  })
  it("round-trips through the columns", () => {
    expect(linkFromRow(linkToColumns(saving))).toEqual(saving)
    expect(linkFromRow(linkToColumns(weekly))).toEqual(weekly)
  })
  it("ignores rows from before the migration, free goals and unreadable params", () => {
    expect(linkFromRow({})).toBeUndefined()
    expect(linkFromRow(linkToColumns(undefined))).toBeUndefined()
    expect(linkFromRow({ kind: "linked", params: { kind: "nope" }, start_date: "2026-11-01" })).toBeUndefined()
    expect(linkFromRow({ kind: "linked", params: weekly.spec as Record<string, unknown>, start_date: null })).toBeUndefined()
  })
})

describe("mergeLinks: database first, this device as the fallback", () => {
  it("before the migration (rows without the columns) the device link is used", () => {
    expect(mergeLinks([{ id: "g1" }, { id: "g2" }], { g1: weekly })).toEqual({ g1: weekly })
  })
  it("after the migration the database link wins over a stale device copy", () => {
    const rows = [{ id: "g1", ...linkToColumns(saving) }]
    expect(mergeLinks(rows, { g1: weekly })).toEqual({ g1: saving })
  })
  it("a goal linked before the migration keeps its device link while the database still says free", () => {
    const rows = [{ id: "g1", ...linkToColumns(undefined) }]
    expect(mergeLinks(rows, { g1: weekly })).toEqual({ g1: weekly })
  })
  it("links of goals that no longer exist are dropped", () => {
    expect(mergeLinks([{ id: "g1" }], { gone: weekly })).toEqual({})
  })
})
