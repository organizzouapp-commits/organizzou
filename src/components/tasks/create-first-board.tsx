"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createBoard } from "@/features/tasks/actions"

export function CreateFirstBoard() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createBoard({ name: "Meu quadro" })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          router.push(`/tarefas/${result.data.id}`)
        })
      }
    >
      {pending ? "Criando…" : "Criar quadro"}
    </Button>
  )
}
