"use client"

import { ArchiveIcon, ArchiveRestoreIcon, BookMarkedIcon, BookOpenIcon, GraduationCapIcon, PencilIcon, TargetIcon, Trash2Icon, type LucideIcon } from "lucide-react"

import { AddPill, HatchedProgress } from "@/components/finance/parts"
import { ActionMenu } from "@/components/organizzou/action-menu"
import { durationText, percentOf } from "@/features/studies/stats"
import { PRIORITY_LABELS, SUBJECT_TYPE_LABELS, type SubjectRow, type SubjectType } from "@/features/studies/types"
import { cn } from "@/lib/utils"

const TYPE_ICONS: Record<SubjectType, LucideIcon> = { subject: BookOpenIcon, course: GraduationCapIcon, book: BookMarkedIcon, exam: TargetIcon }
const chip = "tabular inline-flex h-6 shrink-0 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"

type Props = {
  subjects: SubjectRow[]
  archivedIds: string[]
  weekMinutes: (subjectId: string) => number
  isMobile: boolean
  onNew: () => void
  onEdit: (subject: SubjectRow) => void
  onArchive: (subject: SubjectRow, archived: boolean) => void
  onDelete: (subject: SubjectRow) => void
}

function SubjectCard({ s, done, archived, isMobile, onEdit, onArchive, onDelete }: { s: SubjectRow; done: number; archived: boolean; isMobile: boolean; onEdit: () => void; onArchive: () => void; onDelete: () => void }) {
  const Icon = TYPE_ICONS[s.type]
  return (
    <section aria-label={s.name} data-subject={s.id} data-archived={archived} className={cn("relative flex min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-card p-4 md:p-5", archived && "opacity-70")}>
      {/* The whole card opens the edit sheet; the "…" menu sits above it. */}
      <button type="button" aria-label={`Editar ${s.name}`} onClick={onEdit} className="absolute inset-0 rounded-[20px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
      <div className="pointer-events-none relative flex items-center gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border">
          <Icon strokeWidth={1.75} className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-[16px] leading-6 font-semibold">{s.name}</h3>
          <p className="truncate text-[13px] leading-5 text-muted-foreground">
            {SUBJECT_TYPE_LABELS[s.type]}
            {s.progress_label ? ` · ${s.progress_label}` : ""}
          </p>
        </div>
        <span data-chip className={chip}>
          {archived ? "arquivada" : `prioridade ${PRIORITY_LABELS[s.priority].toLowerCase()}`}
        </span>
        <span className="pointer-events-auto -mr-2">
          <ActionMenu
            ariaLabel={`Opções de ${s.name}`}
            title={s.name}
            mobile={isMobile}
            items={[
              { label: "Editar", icon: PencilIcon, run: onEdit },
              { label: archived ? "Restaurar" : "Arquivar", icon: archived ? ArchiveRestoreIcon : ArchiveIcon, run: onArchive },
              { label: "Excluir", icon: Trash2Icon, run: onDelete, separated: true },
            ]}
          />
        </span>
      </div>
      <div className="pointer-events-none relative flex flex-col gap-2">
        <div className="tabular flex justify-between gap-3 text-[13px] leading-5">
          <span>Meta da semana</span>
          <span className="text-muted-foreground">
            {durationText(done)} de {durationText(s.weekly_goal_min)}
          </span>
        </div>
        <HatchedProgress value={percentOf(done, s.weekly_goal_min)} label={`Meta semanal de ${s.name}`} className="h-2" />
        {s.progress_pct !== null ? (
          <>
            <div className="tabular mt-1 flex justify-between gap-3 text-[13px] leading-5">
              <span>Andamento</span>
              <span className="text-muted-foreground">{s.progress_pct}%</span>
            </div>
            <HatchedProgress value={s.progress_pct} label={`Andamento de ${s.name}`} className="h-2" />
          </>
        ) : null}
      </div>
    </section>
  )
}

/** The subjects of the person with this week's goal. Each card opens the edit sheet and has a "…" menu (edit, archive, delete); archived ones wait at the bottom. */
export function MateriasTab({ subjects, archivedIds, weekMinutes, isMobile, onNew, onEdit, onArchive, onDelete }: Props) {
  const active = subjects.filter((s) => !archivedIds.includes(s.id))
  const archived = subjects.filter((s) => archivedIds.includes(s.id))
  const grid = "grid grid-cols-1 gap-4 @min-[720px]:grid-cols-2 @min-[1100px]:grid-cols-3"
  return (
    <div data-testid="estudos-materias" className="@container flex min-w-0 flex-col gap-4">
      <AddPill label="Nova matéria" onClick={onNew} />
      {subjects.length === 0 ? (
        <div data-testid="no-subjects" className="flex flex-col items-center gap-3 rounded-[20px] border border-border p-8 text-center">
          <BookOpenIcon aria-hidden strokeWidth={1.75} className="size-7 text-muted-foreground" />
          <p className="text-[15px] leading-6 font-medium">Nenhuma matéria ainda</p>
          <p className="max-w-80 text-[13px] leading-5 text-muted-foreground">Cadastre o que você estuda (matéria, curso, livro ou concurso) com uma meta semanal. O cronômetro e os gráficos usam isso.</p>
          <AddPill label="Criar a primeira matéria" onClick={onNew} className="max-w-72" />
        </div>
      ) : (
        <>
          <div className={grid}>
            {active.map((s) => (
              <SubjectCard key={s.id} s={s} done={weekMinutes(s.id)} archived={false} isMobile={isMobile} onEdit={() => onEdit(s)} onArchive={() => onArchive(s, true)} onDelete={() => onDelete(s)} />
            ))}
          </div>
          {archived.length > 0 ? (
            <div data-testid="archived-subjects" className="flex flex-col gap-3">
              <h3 className="text-[11px] leading-4 font-semibold tracking-[0.12em] text-muted-foreground uppercase">Arquivadas · {archived.length}</h3>
              <div className={grid}>
                {archived.map((s) => (
                  <SubjectCard key={s.id} s={s} done={weekMinutes(s.id)} archived isMobile={isMobile} onEdit={() => onEdit(s)} onArchive={() => onArchive(s, false)} onDelete={() => onDelete(s)} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
