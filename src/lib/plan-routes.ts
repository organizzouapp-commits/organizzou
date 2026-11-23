import type { Feature } from "./plans"

/** Which Pro feature a page of the app needs, by its path. Pure. `null` = free for everyone (Hoje, Tarefas, Finanças, Configurações, Ajuda). */
const ROUTES: { prefix: string; feature: Feature; name: string }[] = [
  { prefix: "/dashboard/agenda", feature: "moduleAgenda", name: "Agenda" },
  { prefix: "/dashboard/rotina", feature: "moduleRotina", name: "Rotina" },
  { prefix: "/dashboard/treinos", feature: "moduleTreinos", name: "Treinos" },
  { prefix: "/dashboard/dieta", feature: "moduleDieta", name: "Dieta" },
  { prefix: "/dashboard/estudos", feature: "moduleEstudos", name: "Estudos" },
  { prefix: "/dashboard/notas", feature: "moduleNotas", name: "Notas e lembretes" },
  { prefix: "/dashboard/metas", feature: "moduleMetas", name: "Metas" },
  { prefix: "/dashboard/diario", feature: "moduleDiario", name: "Diário" },
  { prefix: "/dashboard/cofre", feature: "moduleCofre", name: "Cofre" },
]

export function moduleForPath(pathname: string): { feature: Feature; name: string } | null {
  const hit = ROUTES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))
  return hit ? { feature: hit.feature, name: hit.name } : null
}

/** What each locked module offers, in three short lines. */
export const MODULE_BENEFITS: Record<string, string[]> = {
  moduleAgenda: ["Eventos, repetições e lembretes no calendário", "Visão do dia, da semana e do mês", "Avisos no celular antes de cada compromisso"],
  moduleRotina: ["Hábitos diários com sequência e metas", "Água, sono e o que mais você quiser acompanhar", "Lembretes para não perder o ritmo"],
  moduleTreinos: ["Fichas de treino com séries, repetições e carga", "Histórico para ver a evolução", "Treinos que aparecem no seu dia"],
  moduleDieta: ["Refeições, calorias e macros do dia", "Metas de água e de peso", "Histórico do seu peso"],
  moduleEstudos: ["Matérias, provas e metas semanais", "Cartões de revisão para memorizar", "Tempo de estudo registrado"],
  moduleNotas: ["Notas organizadas em pastas, com busca", "Lembretes ligados às suas anotações", "Tudo guardado e sempre à mão"],
  moduleMetas: ["Metas de vida com marcos e prazo", "Ligação com hábitos, treinos e finanças", "Progresso calculado sozinho"],
  moduleDiario: ["Um registro por dia, com humor e sono", "Revisão da semana e do mês", "Privado, só seu"],
  moduleCofre: ["Senhas e dados sensíveis protegidos", "Criptografia no seu dispositivo", "Nunca enviado ao assistente"],
}
