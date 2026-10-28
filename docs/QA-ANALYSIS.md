# Análise do relatório de QA

Relatório gerado: `docs/QA-REPORT.md` (varredura completa em 16 min, 21 rotas, 1440x900 e 390x844). A primeira versão, antes
das correções, está em `docs/QA-REPORT.initial.md`.

## Corrigidos

- Exceção `modules is not defined` em `/dashboard/ajuda` (mobile) e aviso "script tag rendered by React" em `/politicas`:
  o script do preloader agora é carregado por `next/script` no layout raiz.
- Nenhum overflow horizontal e nenhum texto cortado no meio da palavra em nenhuma rota, nos dois tamanhos.
- Nenhuma resposta HTTP 4xx/5xx e nenhuma exceção não tratada.

## Itens restantes (explicados)

| Item | Severidade | Explicação |
|---|---|---|
| Botões dos passos "1 Veja seu dia organizado" / "1 Crie sua conta agora" sem efeito | média | Decorativos: o passo 1 já é o ativo, então clicar nele não muda nada. Não é bug |
| Link "Termos de uso" em `/` (mobile) sem efeito | média | O link só leva a `/politicas#termos`; o clique da varredura caiu enquanto o preloader do site ainda cobria a página. Provável causa, não confirmada em teste dedicado |
| Aviso `preloaded using link preload but not used` (logo de carregamento) | baixa | O React pré-carrega automaticamente a imagem renderizada no fallback `loading.tsx`; quando o conteúdo chega o fallback some e o Chrome avisa. Só aparece em dev e não afeta nada |
| Avisos `powerPreference ... requestAdapter` / `No available adapters` | baixa | Ruído do Chromium no Windows (WebGPU), fora do nosso código |
| "não foi possível clicar (coberto/instável)" no mobile (chips "Hoje", "Organização", sugestões do assistente) | baixa | A barra superior e o pill inferior do mobile se escondem e reaparecem durante a rolagem da própria varredura; o elemento se move entre a checagem e o clique. Os cabeçalhos do mobile estão fechados e não foram alterados |
