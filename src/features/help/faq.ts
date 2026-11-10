// The Ajuda FAQ: the questions, answers written as text and links (so they can point at a tab of Configurações), and the live search.
import { settingsHref } from "@/lib/settings-tabs"

export type AnswerPart = string | { label: string; href: string }
export type FaqItem = { id: string; q: string; a: AnswerPart[] }

export const FAQ: FaqItem[] = [
  {
    id: "assistente-como",
    q: "Como falo com o assistente?",
    a: ["O assistente virtual (Plano Pro) fica no menu lateral: toque em “Assistente virtual” para conversar. Em qualquer plano, use o Novo (captura rápida) para anotar uma tarefa, um gasto ou uma nota em uma frase. Também dá para ditar pelo microfone do navegador."],
  },
  {
    id: "assistente-o-que",
    q: "O que o assistente consegue fazer?",
    a: ["Hoje o assistente é uma prévia: mostra como vai registrar tarefas, gastos e notas e responder perguntas sobre o seu dia, mas as respostas são de exemplo e nada é salvo. Toque no botão do assistente para experimentar."],
  },
  {
    id: "seguranca",
    q: "Meus dados estão seguros?",
    a: ["Seus dados ficam isolados por conta. O cofre de senhas é criptografado no seu dispositivo e o assistente nunca tem acesso a ele. Veja os detalhes na ", { label: "política de privacidade", href: "/politicas#privacidade" }, ". As preferências de cookies ficam em ", { label: "Configurações > Segurança e dados", href: settingsHref("seguranca") }, "."],
  },
  {
    id: "senha",
    q: "Como altero minha senha ou meus dados?",
    a: ["Em ", { label: "Configurações > Perfil", href: settingsHref("perfil") }, " você edita nome e telefone e troca a senha quando quiser."],
  },
  {
    id: "tema",
    q: "Como mudo entre o tema claro e o escuro?",
    a: ["Use o botão de sol e lua no topo da tela, ou escolha em ", { label: "Configurações > Aparência", href: settingsHref("aparencia") }, ". O app lembra a sua escolha e a usa em todos os seus aparelhos."],
  },
  {
    id: "plano",
    q: "Como funciona o plano gratuito e o Plano Pro?",
    a: ["O Plano Gratuito tem limites de listas de tarefas e de mensagens por dia com o assistente. O Plano Pro remove esses limites. O pagamento ainda não está disponível: você pode entrar na lista de espera em ", { label: "Configurações > Plano e cobrança", href: settingsHref("plano") }, "."],
  },
  {
    id: "avisos",
    q: "Como escolho o que o Organizzou avisa?",
    a: ["Em ", { label: "Configurações > Avisos", href: settingsHref("avisos") }, " você escolhe os eventos e o horário de silêncio. Os avisos ainda não são enviados; suas escolhas ficam guardadas neste aparelho para quando o envio abrir."],
  },
  {
    id: "excluir",
    q: "Como excluo minha conta?",
    a: ["A exclusão pela própria tela ainda não está disponível (em ", { label: "Configurações > Segurança e dados", href: settingsHref("seguranca") }, " o botão aparece desabilitado). Fale com a gente pelo contato ao lado e cuidamos disso com você."],
  },
]

/** Lower case without accents, so "senha" finds "Senha" and "configuracoes" finds "Configurações". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** The answer as plain text (what the search reads). */
export const answerText = (parts: AnswerPart[]): string => parts.map((p) => (typeof p === "string" ? p : p.label)).join("")

/** Every word typed has to appear in the question or the answer; nothing typed shows everything. */
export function filterFaq(items: FaqItem[], query: string): FaqItem[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  return items.filter((item) => terms.every((term) => normalize(`${item.q} ${answerText(item.a)}`).includes(term)))
}
