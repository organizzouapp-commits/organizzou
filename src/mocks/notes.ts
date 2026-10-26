import type { NoteFolderRow, NoteRow, ReminderRow } from "@/features/notes/types"

import { at } from "./time"

const USER = "00000000-0000-4000-8000-000000000001"

export const mockFolders: NoteFolderRow[] = [
  { id: "n0000000-0000-4000-8000-000000000001", user_id: USER, name: "Trabalho" },
  { id: "n0000000-0000-4000-8000-000000000002", user_id: USER, name: "Estudos" },
  { id: "n0000000-0000-4000-8000-000000000003", user_id: USER, name: "Pessoal" },
  { id: "n0000000-0000-4000-8000-000000000004", user_id: USER, name: "Ideias" },
]

const [WORK, STUDY, PERSONAL, IDEAS] = mockFolders.map((f) => f.id)

export function buildMockNotes(now: string): NoteRow[] {
  const note = (n: number, folder: string | null, title: string, body: string, pinned: boolean, tags: string[], daysAgo: number): NoteRow => ({
    id: `no000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
    user_id: USER,
    folder_id: folder,
    title,
    body,
    pinned,
    tags,
    created_at: at(now, -daysAgo - 3, "09:00"),
    updated_at: at(now, -daysAgo, "18:20"),
  })
  return [
    note(
      1,
      WORK,
      "Ata — alinhamento semanal",
      "# Alinhamento semanal\n\n**Participantes:** Marina, Rafael, Júlia e eu.\n\n## Decisões\n- Fechar a proposta da Almeida & Filhos até quinta\n- Rafael assume o relatório de custos do 3º trimestre\n- Nova rotina: *daily* de 10 minutos às 9h30\n\n## Próximos passos\n- Enviar o relatório semanal à Marina\n- Agendar entrevista da vaga de analista",
      true,
      ["reunião", "time"],
      0
    ),
    note(
      2,
      PERSONAL,
      "Lista de compras do mês",
      "## Mercado\n- Arroz, feijão e macarrão\n- Frango e ovos\n- Frutas: banana, maçã e mamão\n- Café e leite\n\n## Casa\n- Detergente e esponjas\n- Lâmpada para a cozinha",
      false,
      ["casa"],
      1
    ),
    note(
      3,
      STUDY,
      "Resumo — Direito Constitucional",
      "# Princípios fundamentais\n\nOs **fundamentos da República** estão no art. 1º: soberania, cidadania, dignidade da pessoa humana, valores sociais do trabalho e da livre iniciativa e pluralismo político.\n\n## Poderes da União\n- Legislativo\n- Executivo\n- Judiciário\n\n*Revisar o capítulo sobre controle de constitucionalidade antes da prova.*",
      true,
      ["oab", "revisão"],
      2
    ),
    note(
      4,
      IDEAS,
      "Ideias para o aniversário da mãe",
      "# Aniversário da mãe\n\n- Almoço surpresa no sábado, na casa da tia Rosa\n- Álbum de fotos impresso\n- Bolo de cenoura com cobertura de chocolate (receita da vovó)\n\n**Orçamento:** até R$ 600,00",
      false,
      ["família"],
      4
    ),
    note(
      5,
      PERSONAL,
      "Roteiro — Florianópolis",
      "# Florianópolis, dezembro\n\n## Hospedagem\n- Pousada na Lagoa da Conceição (R$ 280,00 a diária)\n\n## Passeios\n- Trilha da Lagoinha do Leste\n- Pôr do sol na Praia Mole\n- Jantar de frutos do mar no Ribeirão da Ilha\n\n*Comprar passagem até o fim do mês.*",
      false,
      ["viagem"],
      6
    ),
    note(
      6,
      IDEAS,
      "Ideias de conteúdo para o blog",
      "- Como organizei minha rotina de estudos em 4 semanas\n- 5 hábitos que mudaram meu ano\n- Planilha de gastos: o que aprendi\n- Treino em casa para quem tem pouco tempo",
      false,
      ["blog"],
      9
    ),
    note(
      7,
      WORK,
      "Checklist de fechamento do mês",
      "## Financeiro\n- Conciliar notas fiscais\n- Enviar cobranças pendentes\n- Atualizar planilha de custos\n\n## Pessoas\n- Avaliar desempenho do time\n- Alinhar férias de dezembro",
      false,
      ["financeiro"],
      12
    ),
    note(8, null, "Anotação rápida", "Ligar para o contador sobre o imposto de renda do ano passado.", false, [], 15),
  ]
}

export function buildMockReminders(now: string): ReminderRow[] {
  const reminder = (n: number, title: string, offset: number, time: string, channels: ReminderRow["channels"], status: ReminderRow["status"] = "pending"): ReminderRow => ({
    id: `re000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
    user_id: USER,
    title,
    remind_at: at(now, offset, time),
    channels,
    status,
    note_id: null,
  })
  return [
    reminder(1, "Ligar para o contador sobre o imposto de renda", 0, "15:00", ["push", "whatsapp"]),
    reminder(2, "Levar o carro para a revisão", 0, "17:30", ["whatsapp"]),
    reminder(3, "Pagar o boleto da faculdade", 1, "09:00", ["push", "whatsapp"]),
    reminder(4, "Comprar presente da mãe", 3, "12:00", ["push"]),
    reminder(5, "Renovar assinatura do antivírus", 8, "10:00", ["push"]),
    reminder(6, "Enviar documentos ao contador", -1, "11:00", ["push"], "done"),
  ]
}
