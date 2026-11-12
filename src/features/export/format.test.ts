import { describe, expect, it } from "vitest"

import { centsToDecimalComma, csvCell, csvColumns, EXPORT_MODULES, exportFilename, isDateColumn, localizedDate, toCsv } from "./format"

describe("csv cells", () => {
  it("quotes what needs quotes and keeps the rest plain", () => {
    expect(csvCell("Mercado")).toBe("Mercado")
    expect(csvCell("a;b")).toBe('"a;b"')
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""')
    expect(csvCell("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"')
    expect(csvCell(null)).toBe("")
    expect(csvCell(["a", "b"])).toBe('"[""a"",""b""]"')
  })
  it("defuses formulas but keeps negative numbers", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)")
    expect(csvCell("@cmd")).toBe("'@cmd")
    expect(csvCell("-12,5")).toBe("-12,5")
  })
})

describe("money and dates", () => {
  it("writes cents as reais with a comma", () => {
    expect(centsToDecimalComma(123456)).toBe("1234,56")
    expect(centsToDecimalComma(5)).toBe("0,05")
    expect(centsToDecimalComma(-1050)).toBe("-10,50")
  })
  it("localizes ISO days and moments", () => {
    expect(localizedDate("2026-11-12")).toBe("12/11/2026")
    expect(localizedDate("2026-11-12T01:00:00Z")).toBe("11/11/2026")
    expect(localizedDate("nada")).toBe("nada")
    expect(isDateColumn("occurred_on")).toBe(true)
    expect(isDateColumn("created_at")).toBe(true)
    expect(isDateColumn("name")).toBe(false)
  })
})

describe("toCsv", () => {
  const rows = [
    { id: "b", name: "Café; e pão", amount_cents: 1234, occurred_on: "2026-11-12" },
    { id: "a", name: "Aluguel", amount_cents: 150000, occurred_on: "2026-11-10" },
  ]
  it("has a BOM, semicolons, CRLF, decimal comma and a localized date column", () => {
    const csv = toCsv(rows)
    expect(csv.startsWith("﻿")).toBe(true)
    const lines = csv.slice(1).trimEnd().split("\r\n")
    expect(lines[0]).toBe("id;amount_cents;name;occurred_on;occurred_on_local")
    expect(lines[1]).toBe('b;12,34;"Café; e pão";2026-11-12;12/11/2026')
    expect(lines[2]).toBe("a;1500,00;Aluguel;2026-11-10;10/11/2026")
  })
  it("an empty table is just the header-less BOM and newline", () => {
    expect(csvColumns([])).toEqual([])
  })
})

describe("what is exported", () => {
  it("covers every module and never lists the vault", () => {
    const tables = EXPORT_MODULES.flatMap((m) => m.tables)
    expect(tables).toContain("finance_bills")
    expect(tables).toContain("notes")
    expect(new Set(tables).size).toBe(tables.length)
    expect(tables.join(" ")).not.toMatch(/vault/)
  })
  it("names the file by day", () => {
    expect(exportFilename("2026-11-12", "json")).toBe("organizzou-export-2026-11-12.json")
    expect(exportFilename("2026-11-12", "zip")).toBe("organizzou-export-2026-11-12.zip")
  })
})
