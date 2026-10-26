import type { VaultFolderRow, VaultItemRow } from "@/features/vault/types"

import { at } from "./time"

export const mockVaultFolders: VaultFolderRow[] = [
  { id: "vf000000-0000-4000-8000-000000000001", name: "Pessoal" },
  { id: "vf000000-0000-4000-8000-000000000002", name: "Trabalho" },
  { id: "vf000000-0000-4000-8000-000000000003", name: "Finanças" },
]

const [PERSONAL, WORK, FINANCE] = mockVaultFolders.map((f) => f.id)

/** All values are fictional. Passwords are plain text only because this is example data. */
export function buildMockVaultItems(now: string): VaultItemRow[] {
  const login = (n: number, folder: string, name: string, username: string, password: string, url: string, daysAgo: number): VaultItemRow => ({
    id: `vi000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
    folder_id: folder,
    type: "login",
    name,
    fields: [
      { label: "Usuário", value: username },
      { label: "Senha", value: password },
      { label: "Site", value: url },
    ],
    secrets: ["Senha"],
    password,
    updated_at: at(now, -daysAgo, "10:00"),
  })
  return [
    login(1, PERSONAL, "Gmail", "patricia.exemplo@gmail.com", "r7#Kp9!vQ2$mZx4L", "https://mail.google.com", 12),
    login(2, FINANCE, "Nubank", "112.223.334-45", "Cx8$wN2@pL5!tR7e", "https://nubank.com.br", 30),
    login(3, FINANCE, "Banco Itaú", "agência 0123 conta 45678-9", "Itau@2023", "https://www.itau.com.br", 210),
    login(4, PERSONAL, "Netflix", "patricia.exemplo@gmail.com", "Viagem@2024", "https://www.netflix.com", 95),
    login(5, PERSONAL, "Spotify", "patricia.exemplo@gmail.com", "Viagem@2024", "https://www.spotify.com", 95),
    login(6, WORK, "GitHub", "patricia-dev", "m4K!zT9#vB6$qW2n", "https://github.com", 20),
    login(7, PERSONAL, "Amazon", "patricia.exemplo@gmail.com", "senha123", "https://www.amazon.com.br", 400),
    login(8, WORK, "Painel da empresa (Alfa)", "patricia.silva", "Alfa#Sistema2025", "https://painel.alfa.example", 45),
    {
      id: "vi000000-0000-4000-8000-000000000009",
      folder_id: FINANCE,
      type: "card",
      name: "Cartão Nubank Mastercard",
      fields: [
        { label: "Titular", value: "PATRICIA S EXEMPLO" },
        { label: "Número", value: "5200 8282 8282 8210" },
        { label: "Validade", value: "08/29" },
        { label: "CVV", value: "123" },
      ],
      secrets: ["Número", "CVV"],
      updated_at: at(now, -60, "10:00"),
    },
    {
      id: "vi000000-0000-4000-8000-000000000010",
      folder_id: PERSONAL,
      type: "document",
      name: "CPF e RG",
      fields: [
        { label: "CPF", value: "000.000.000-00" },
        { label: "RG", value: "00.000.000-0 SSP/SP" },
        { label: "Data de nascimento", value: "14/03/1991" },
      ],
      secrets: ["CPF", "RG"],
      updated_at: at(now, -150, "10:00"),
    },
    {
      id: "vi000000-0000-4000-8000-000000000011",
      folder_id: PERSONAL,
      type: "secure_note",
      name: "Códigos de recuperação do Gmail",
      fields: [{ label: "Nota", value: "1) 4821 7733\n2) 9054 1182\n3) 3317 6609\n4) 7720 5148" }],
      secrets: ["Nota"],
      updated_at: at(now, -200, "10:00"),
    },
  ]
}
