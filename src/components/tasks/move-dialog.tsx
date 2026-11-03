"use client"

import { CheckIcon } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import type { ListRow } from "@/features/tasks/types"

type MoveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lists: ListRow[]
  /** The list the task(s) are in now (marked); null for a mixed selection. */
  currentListId: string | null
  title?: string
  onPick: (listId: string) => void
}

/** "Mover para…": the non-drag way to change a task's status. A bottom sheet on phones, a dialog on desktop. */
export function MoveDialog({ open, onOpenChange, lists, currentListId, title = "Mover para…", onPick }: MoveDialogProps) {
  const isMobile = useIsMobile()
  const options = (
    <ul className="flex flex-col">
      {lists.map((list) => {
        const current = list.id === currentListId
        return (
          <li key={list.id}>
            <button
              type="button"
              disabled={current}
              onClick={() => {
                onPick(list.id)
                onOpenChange(false)
              }}
              className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50", current && "text-muted-foreground")}
            >
              <span className="flex-1">{list.name}</span>
              {current ? <CheckIcon aria-label="Status atual" strokeWidth={1.75} className="size-4" /> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[80dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className="sr-only">Escolha o status.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{options}</div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-[20px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Escolha o status.</DialogDescription>
        </DialogHeader>
        {options}
      </DialogContent>
    </Dialog>
  )
}
