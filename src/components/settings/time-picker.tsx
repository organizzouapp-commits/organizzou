"use client"

import { useEffect, useRef, useState } from "react"
import { ClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { useRestoreFocus } from "@/hooks/use-restore-focus"
import { HOURS, MINUTES, joinTime, pad2, snapMinute, splitTime } from "@/features/settings/notification-prefs"
import { cn } from "@/lib/utils"

function Column({ label, values, selected, onPick }: { label: string; values: number[]; selected: number; onPick: (value: number) => void }) {
  return (
    <div role="listbox" aria-label={label} className="no-scrollbar flex max-h-56 min-w-20 flex-1 flex-col gap-1 overflow-y-auto">
      {values.map((value) => {
        const on = value === selected
        return (
          <button
            key={value}
            type="button"
            role="option"
            aria-selected={on}
            onClick={() => onPick(value)}
            className={cn(
              "tabular flex h-11 shrink-0 items-center justify-center rounded-full text-[15px] outline-none transition-colors duration-[400ms] focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              on ? "bg-highlight font-semibold text-highlight-foreground" : "hover:bg-accent"
            )}
          >
            {pad2(value)}
          </button>
        )
      })}
    </div>
  )
}

/**
 * A time field (44 px, clock icon) that opens a picker: hours and minutes (15-minute steps) side by side, the choice in Lima, "Ok" to apply.
 * A popover on desktop, a bottom sheet on phones. The value stays an "HH:MM" string.
 */
export function TimePicker({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [hour, setHour] = useState(0)
  const [minute, setMinute] = useState(0)
  const body = useRef<HTMLDivElement>(null)
  useRestoreFocus(open)

  function toggle(next: boolean) {
    if (next) {
      const current = splitTime(value)
      setHour(current.hour)
      setMinute(snapMinute(current.minute))
    }
    setOpen(next)
  }

  // Bring the chosen hour and minute into view when the picker opens.
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => body.current?.querySelectorAll<HTMLElement>("[aria-selected=true]").forEach((el) => el.scrollIntoView({ block: "center" })), 30)
    return () => window.clearTimeout(id)
  }, [open])

  const picker = (
    <div ref={body} className="flex flex-col gap-3">
      <div className="flex gap-3">
        <Column label="Hora" values={HOURS} selected={hour} onPick={setHour} />
        <Column label="Minutos" values={MINUTES} selected={minute} onPick={setMinute} />
      </div>
      <Button
        type="button"
        data-testid="time-ok"
        onClick={() => {
          onChange(joinTime(hour, minute))
          setOpen(false)
        }}
        className="h-11 w-full rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90 md:h-11"
      >
        Ok
      </Button>
    </div>
  )

  const trigger = (
    <button
      id={id}
      type="button"
      disabled={disabled}
      aria-label={`${label}: ${value}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={isMobile ? () => toggle(true) : undefined}
      className="tabular flex h-11 w-full items-center justify-between gap-2 rounded-[12px] border border-input bg-transparent px-3 text-[15px] outline-none transition-colors duration-[400ms] hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:bg-input/30"
    >
      {value}
      <ClockIcon aria-hidden strokeWidth={1.75} className="size-4 text-muted-foreground" />
    </button>
  )

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={toggle}>
          <DrawerContent className="max-h-[88dvh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>{label}</DrawerTitle>
              <DrawerDescription>Escolha a hora e os minutos.</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{picker}</div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }
  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        {picker}
      </PopoverContent>
    </Popover>
  )
}
