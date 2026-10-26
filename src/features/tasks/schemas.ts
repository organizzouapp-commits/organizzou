import { z } from "zod"

import { swatchSchema } from "@/lib/swatches"

import { PRIORITIES } from "./types"

const id = z.uuid("Identificador inválido.")
const title = z.string().trim().min(1, "Informe um título.").max(200, "Use no máximo 200 caracteres.")
const name = (label: string) =>
  z.string().trim().min(1, `Informe o nome ${label}.`).max(80, "Use no máximo 80 caracteres.")

export const prioritySchema = z.enum(PRIORITIES)

export const createBoardSchema = z.object({ name: name("do quadro") })
export const renameBoardSchema = z.object({ id, name: name("do quadro") })

export const createListSchema = z.object({ boardId: id, name: name("da lista") })
export const updateListSchema = z.object({
  id,
  name: name("da lista").optional(),
  isDoneList: z.boolean().optional(),
})
export const reorderListsSchema = z.object({ boardId: id, listIds: z.array(id).min(1) })

export const createTaskSchema = z.object({
  boardId: id,
  listId: id,
  title,
  description: z.string().max(10_000).nullish(),
  priority: prioritySchema.optional(),
  dueAt: z.iso.datetime({ offset: true }).nullish(),
  dueHasTime: z.boolean().optional(),
  category: z.string().trim().max(60).nullish(),
  swatch: swatchSchema.optional(),
})

export const updateTaskSchema = z.object({
  id,
  patch: z
    .object({
      title,
      description: z.string().max(10_000).nullable(),
      priority: prioritySchema,
      dueAt: z.iso.datetime({ offset: true }).nullable(),
      dueHasTime: z.boolean(),
      category: z.string().trim().max(60).nullable(),
      swatch: swatchSchema,
    })
    .partial(),
})

export const moveTasksSchema = z.object({ listId: id, taskIds: z.array(id).min(1) })
export const completeTaskSchema = z.object({ id, done: z.boolean() })

export const createTagSchema = z.object({ name: z.string().trim().min(1, "Informe o nome da tag.").max(40), swatch: swatchSchema.optional() })
export const setTaskTagsSchema = z.object({ taskId: id, tagIds: z.array(id) })

export const addChecklistItemSchema = z.object({
  taskId: id,
  text: z.string().trim().min(1, "Escreva o item.").max(300),
})
export const updateChecklistItemSchema = z.object({
  id,
  text: z.string().trim().min(1).max(300).optional(),
  done: z.boolean().optional(),
})

export const addCommentSchema = z.object({
  taskId: id,
  body: z.string().trim().min(1, "Escreva o comentário.").max(4000),
})

export const registerAttachmentSchema = z.object({
  taskId: id,
  storagePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(120).nullish(),
  sizeBytes: z.number().int().min(0).max(10 * 1024 * 1024),
})

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
