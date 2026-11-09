"use client"

import { BookMarkedIcon, BookOpenIcon, GraduationCapIcon, TargetIcon, type LucideIcon } from "lucide-react"

import { AddPill, HatchedProgress } from "@/components/finance/parts"
import { durationText, percentOf } from "@/features/studies/stats"
import { PRIORITY_LABELS, SUBJECT_TYPE_LABELS, type SubjectRow, type SubjectType } from "@/features/studies/types"

const TYPE_ICONS: Record<SubjectType, LucideIcon> = { subject: BookOpenIcon, course: GraduationCapIcon, book: BookMarkedIcon, exam: TargetIcon }
const chip = "tabular inline-flex h-6 shrink-0 items-center rounded-full border border-foreground/25 px-2 text-[12px] leading-4 whitespace-nowrap text-muted-foreground"

/** The subjects of the person with this week's goal, in the same cards, chips and hatched bars as the other tabs. */
export function MateriasTab({ subjects, weekMinutes, onNew }: { subjects: SubjectRow[]; weekMinutes: (subjectId: string) => number; onNew: () => void }) {
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
        <div className="grid grid-cols-1 gap-4 @min-[720px]:grid-cols-2 @min-[1100px]:grid-cols-3">
          {subjects.map((s) => {
            const Icon = TYPE_ICONS[s.type]
            const done = weekMinutes(s.id)
            return (
              <section key={s.id} aria-label={s.name} data-subject={s.id} className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-border bg-card p-4 md:p-5">
                <div className="flex items-center gap-3">
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
                    prioridade {PRIORITY_LABELS[s.priority].toLowerCase()}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
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
          })}
        </div>
      )}
    </div>
  )
}
