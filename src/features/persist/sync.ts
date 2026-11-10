// When should a screen replace its rows with the ones the server just sent? Only when the SERVER's rows really changed since the last
// ones it saw (compared by content, not by array identity: a page that builds its `initial` array on every render must not look "new"),
// the screen has nothing of its own waiting to be saved, and the rows differ from what the screen already shows.
export function shouldAdoptServerRows({ lastSeenJson, incoming, hasUnsentChanges, shownJson }: { lastSeenJson: string | null; incoming: unknown; hasUnsentChanges: boolean; shownJson: string }): { adopt: boolean; seenJson: string } {
  const json = JSON.stringify(incoming)
  if (lastSeenJson === json) return { adopt: false, seenJson: json }
  if (hasUnsentChanges) return { adopt: false, seenJson: json }
  return { adopt: json !== shownJson, seenJson: json }
}
