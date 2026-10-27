"use client"

import { createContext, useContext, useTransition } from "react"
import { LogOutIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { signOut } from "@/features/auth/actions"

/** Every "Sair" in the shell (sidebar, rail, avatar menu, "Mais" sheet) asks for confirmation first. */
const SignOutContext = createContext<() => void>(() => {})

export const SignOutProvider = SignOutContext.Provider

/** Returns a function that opens the "Deseja sair da sua conta?" dialog (rendered once by the shell). */
export function useRequestSignOut() {
  return useContext(SignOutContext)
}

export function SignOutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deseja sair da sua conta?</AlertDialogTitle>
          <AlertDialogDescription>Você precisará entrar de novo para acessar o Organizzou.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault() // keep the dialog open while signing out
              startTransition(async () => {
                await signOut()
              })
            }}
          >
            <LogOutIcon strokeWidth={1.75} /> {pending ? "Saindo…" : "Sair"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
