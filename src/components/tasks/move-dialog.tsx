"use client"

import { useEffect, useState } from "react"
import { ArrowLeftIcon, CheckIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ListRow } from "@/features/tasks/types"

import { ResponsiveSheet } from "./responsive-sheet"

type MoveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The lists of the quadro on screen. */
  lists: ListRow[]
  boards: { id: string; name: string }[]
  currentBoardId: string
  /** The list the task(s) are in now (marked); null for a mixed selection. */
  currentListId: string | null
  title?: string
  /** A list of the current quadro. */
  onPick: (listId: string) => void
  /** Another quadro: the lists are fetched when it is chosen. */
  loadLists: (boardId: string) => Promise<ListRow[]>
  onPickInBoard: (boardId: string, listId: string) => void
}

const row = "flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"

/** "Mover para…": two steps, Quadro then Lista (one step when there is a single quadro). A bottom sheet on phones, a dialog on desktop. */
export function MoveDialog(props: MoveDialogProps) {
  const { open, onOpenChange, title = "Mover para…" } = props
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={title} description="Escolha o quadro e a lista.">
      {open ? <Steps {...props} /> : null}
    </ResponsiveSheet>
  )
}

function Steps({ lists, boards, currentBoardId, currentListId, onPick, loadLists, onPickInBoard, onOpenChange }: MoveDialogProps) {
  const [boardId, setBoardId] = useState<string | null>(boards.length > 1 ? null : currentBoardId)
  const [fetched, setFetched] = useState<ListRow[] | null>(null)

  useEffect(() => {
    if (!boardId || boardId === currentBoardId) return
    let cancelled = false
    void loadLists(boardId).then((result) => {
      if (!cancelled) setFetched(result)
    })
    return () => {
      cancelled = true
    }
  }, [boardId, currentBoardId, loadLists])

  if (!boardId) {
    return (
      <ul className="flex flex-col" aria-label="Quadros">
        {boards.map((board) => (
          <li key={board.id}>
            <button type="button" onClick={() => (setFetched(null), setBoardId(board.id))} className={row}>
              <span className="flex-1">{board.name}</span>
              {board.id === currentBoardId ? <span className="text-[13px] text-muted-foreground">Este quadro</span> : null}
              <ChevronRightIcon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    )
  }

  const own = boardId === currentBoardId
  const options = own ? lists : fetched
  return (
    <div className="flex flex-col gap-1">
      {boards.length > 1 ? (
        <Button type="button" variant="ghost" className="h-11 justify-start rounded-full" onClick={() => setBoardId(null)}>
          <ArrowLeftIcon strokeWidth={1.75} /> {boards.find((b) => b.id === boardId)?.name}
        </Button>
      ) : null}
      {options === null ? (
        <p className="px-3 py-4 text-[15px] text-muted-foreground">Carregando as listas…</p>
      ) : options.length === 0 ? (
        <p className="px-3 py-4 text-[15px] text-muted-foreground">Esse quadro ainda não tem listas.</p>
      ) : (
        <ul className="flex flex-col" aria-label="Listas">
          {options.map((list) => {
            const current = own && list.id === currentListId
            return (
              <li key={list.id}>
                <button
                  type="button"
                  disabled={current}
                  onClick={() => {
                    if (own) onPick(list.id)
                    else onPickInBoard(boardId, list.id)
                    onOpenChange(false)
                  }}
                  className={cn(row, current && "text-muted-foreground")}
                >
                  <span className="flex-1">{list.name}</span>
                  {current ? <CheckIcon aria-label="Lista atual" strokeWidth={1.75} className="size-4" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
