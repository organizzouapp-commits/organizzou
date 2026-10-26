import type { BoardData, BoardRow, ListRow, TagRow, TaskView } from "@/features/tasks/types"

import { at, MOCK_TIMEZONE, mockId } from "./time"

const USER = "00000000-0000-4000-8000-000000000001"

function stamp(now: string, offsetDays = -10) {
  const date = new Date(new Date(now).getTime() + offsetDays * 86_400_000).toISOString()
  return { created_at: date, updated_at: date }
}

export type MockBoards = {
  boards: BoardData[]
  tags: TagRow[]
}

type TaskSeed = Partial<TaskView> & { title: string }

/** Example boards and tasks, all dates relative to `now` so "Hoje" and "Atrasadas" always make sense. */
export function buildMockBoards(now: string): MockBoards {
  const tags: TagRow[] = [
    { id: "t0000000-0000-4000-8000-000000000001", user_id: USER, name: "Trabalho", swatch: "tinta-verso", ...stamp(now) },
    { id: "t0000000-0000-4000-8000-000000000002", user_id: USER, name: "Pessoal", swatch: "lima-verso", ...stamp(now) },
    { id: "t0000000-0000-4000-8000-000000000003", user_id: USER, name: "Urgente", swatch: "lima", ...stamp(now) },
    { id: "t0000000-0000-4000-8000-000000000004", user_id: USER, name: "Casa", swatch: "grafite", ...stamp(now) },
    { id: "t0000000-0000-4000-8000-000000000005", user_id: USER, name: "Estudos", swatch: "papel", ...stamp(now) },
  ]
  const [work, personal, urgent, home, study] = tags.map((t) => t.id)

  function makeBoard(
    id: string,
    name: string,
    position: number,
    listNames: [string, string, string],
    seeds: [TaskSeed[], TaskSeed[], TaskSeed[]]
  ): BoardData {
    const board: BoardRow = { id, user_id: USER, name, position, archived: false, ...stamp(now, -30) }
    const lists: ListRow[] = listNames.map((listName, index) => ({
      id: mockId("list"),
      user_id: USER,
      board_id: id,
      name: listName,
      position: (index + 1) * 1000,
      is_done_list: index === 2,
      ...stamp(now, -30),
    }))
    const tasks: TaskView[] = []
    seeds.forEach((list, listIndex) => {
      list.forEach((seed, taskIndex) => {
        tasks.push({
          id: mockId("task"),
          user_id: USER,
          board_id: id,
          list_id: lists[listIndex].id,
          description: null,
          priority: "none",
          due_at: null,
          due_has_time: false,
          category: null,
          swatch: "neutro",
          position: (taskIndex + 1) * 1000,
          completed_at: listIndex === 2 ? at(now, -1 - taskIndex, "16:30") : null,
          archived: false,
          tagIds: [],
          checklistTotal: 0,
          checklistDone: 0,
          commentCount: 0,
          attachmentCount: 0,
          ...stamp(now, -7 - taskIndex),
          ...seed,
        })
      })
    })
    return {
      board,
      boards: [],
      lists,
      tasks,
      tags,
      timezone: MOCK_TIMEZONE,
    }
  }

  const work_board = makeBoard(
    "b0000000-0000-4000-8000-000000000001",
    "Trabalho",
    1000,
    ["A fazer", "Em andamento", "Concluído"],
    [
      [
        {
          title: "Enviar relatório semanal à Marina",
          description: "Resumir entregas da semana, indicadores de vendas e pendências.",
          priority: "high",
          due_at: at(now, 0, "17:00"),
          due_has_time: true,
          category: "Relatórios",
          swatch: "tinta-verso",
          tagIds: [work, urgent],
          checklistTotal: 3,
          checklistDone: 1,
          commentCount: 2,
        },
        {
          title: "Revisar proposta do cliente Almeida & Filhos",
          priority: "medium",
          due_at: at(now, 1, "10:00"),
          due_has_time: true,
          category: "Comercial",
          swatch: "lima",
          tagIds: [work],
          attachmentCount: 1,
        },
        {
          title: "Atualizar planilha de custos do trimestre",
          priority: "low",
          due_at: at(now, 4),
          tagIds: [work],
        },
        { title: "Responder e-mails pendentes", priority: "none", due_at: at(now, -1), tagIds: [work] },
      ],
      [
        {
          title: "Preparar apresentação de resultados do 3º trimestre",
          description: "Slides com gráficos de faturamento e metas atingidas.",
          priority: "high",
          due_at: at(now, 2, "14:00"),
          due_has_time: true,
          category: "Reunião",
          swatch: "tinta-verso",
          tagIds: [work, urgent],
          checklistTotal: 5,
          checklistDone: 3,
          attachmentCount: 2,
          commentCount: 1,
        },
        { title: "Entrevistar candidata para vaga de analista", priority: "medium", due_at: at(now, 3, "11:00"), due_has_time: true, tagIds: [work] },
      ],
      [
        { title: "Fechar contrato com fornecedor de embalagens", priority: "medium", tagIds: [work] },
        { title: "Conciliar notas fiscais de setembro", priority: "low", tagIds: [work] },
      ],
    ]
  )

  const home_board = makeBoard(
    "b0000000-0000-4000-8000-000000000002",
    "Casa e vida",
    2000,
    ["Ideias", "Fazendo", "Feito"],
    [
      [
        { title: "Comprar planta para a sala", swatch: "lima-verso", tagIds: [home] },
        { title: "Planejar viagem de fim de ano para Florianópolis", priority: "low", due_at: at(now, 20), category: "Viagem", tagIds: [personal], checklistTotal: 4, checklistDone: 1 },
        { title: "Pesquisar curso de fotografia", tagIds: [personal, study] },
      ],
      [
        { title: "Organizar o guarda-roupa", priority: "medium", due_at: at(now, 1), swatch: "grafite", tagIds: [home] },
        { title: "Marcar consulta no dentista", priority: "medium", due_at: at(now, 0, "09:00"), due_has_time: true, category: "Saúde", swatch: "lima", tagIds: [personal] },
        { title: "Pagar IPTU da segunda parcela", priority: "high", due_at: at(now, -2), tagIds: [home, urgent] },
      ],
      [
        { title: "Trocar a lâmpada da cozinha", tagIds: [home] },
        { title: "Renovar o seguro do carro", tagIds: [personal] },
      ],
    ]
  )

  const study_board = makeBoard(
    "b0000000-0000-4000-8000-000000000003",
    "Faculdade",
    3000,
    ["A estudar", "Em curso", "Entregue"],
    [
      [
        { title: "Ler capítulo 4 de Direito Constitucional", priority: "medium", due_at: at(now, 2), tagIds: [study] },
        { title: "Resolver lista de exercícios de Estatística", priority: "high", due_at: at(now, 5), tagIds: [study] },
      ],
      [{ title: "Escrever artigo de Metodologia Científica", priority: "high", due_at: at(now, 9), tagIds: [study], checklistTotal: 6, checklistDone: 2 }],
      [{ title: "Entregar resenha de Sociologia", tagIds: [study] }],
    ]
  )

  const boards = [work_board, home_board, study_board]
  const list = boards.map((b) => ({ id: b.board.id, name: b.board.name }))
  for (const board of boards) board.boards = list
  return { boards, tags }
}
