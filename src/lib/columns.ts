/**
 * Deals items into `count` columns one at a time (1st → column 1, 2nd → column 2, 3rd → column 1 …) so that
 * independent flex columns keep the reading order row by row while each card takes only its own height.
 */
export function splitColumns<T>(items: readonly T[], count: number): T[][] {
  const n = Math.max(1, Math.floor(count))
  const columns: T[][] = Array.from({ length: n }, () => [])
  items.forEach((item, index) => columns[index % n].push(item))
  return columns
}
