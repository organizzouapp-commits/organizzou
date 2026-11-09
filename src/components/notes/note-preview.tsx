"use client"

import { CheckIcon } from "lucide-react"

import { parseMarkdown, type Inline } from "@/features/notes/markdown"
import { cn } from "@/lib/utils"

function InlineText({ runs }: { runs: Inline[] }) {
  return (
    <>
      {runs.map((run, index) =>
        run.bold ? (
          <strong key={index} className="font-semibold">
            {run.text}
          </strong>
        ) : run.italic ? (
          <em key={index}>{run.text}</em>
        ) : (
          <span key={index}>{run.text}</span>
        )
      )}
    </>
  )
}

/** The reading view of a note: the lightweight markdown rendered. Checkboxes can be ticked right here. */
export function NotePreview({ source, onToggleLine }: { source: string; onToggleLine?: (line: number) => void }) {
  const blocks = parseMarkdown(source)
  return (
    <div className="flex flex-col gap-3 text-[16px] leading-7">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return block.level === 1 ? (
            <h2 key={index} className="text-[22px] leading-8 font-semibold tracking-[-0.01em]">
              <InlineText runs={block.inline} />
            </h2>
          ) : (
            <h3 key={index} className="text-[18px] leading-7 font-semibold">
              <InlineText runs={block.inline} />
            </h3>
          )
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="flex list-disc flex-col gap-1 pl-5">
              {block.items.map((item, i) => (
                <li key={i}>
                  <InlineText runs={item} />
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === "checklist") {
          return (
            <ul key={index} className="flex flex-col gap-1">
              {block.items.map((item) => (
                <li key={item.line} className="flex items-start gap-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.checked}
                    aria-label={item.inline.map((r) => r.text).join("")}
                    onClick={() => onToggleLine?.(item.line)}
                    className="relative mt-1 flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-foreground/40 outline-none after:absolute after:-inset-3 focus-visible:ring-3 focus-visible:ring-ring/50 aria-checked:border-primary aria-checked:bg-primary aria-checked:text-primary-foreground"
                  >
                    {item.checked ? <CheckIcon aria-hidden strokeWidth={2.5} className="size-3" /> : null}
                  </button>
                  <span className={cn(item.checked && "text-muted-foreground line-through")}>
                    <InlineText runs={item.inline} />
                  </span>
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={index}>
            <InlineText runs={block.inline} />
          </p>
        )
      })}
    </div>
  )
}
