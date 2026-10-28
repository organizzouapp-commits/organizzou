# Primeira abertura lenta: o que medimos e o que mudou

## O que causava as telas em branco de 3 a 4 s

1. **Modo `npm run dev`:** a primeira abertura de cada rota compila a página sob demanda (Turbopack), o que leva de 1 a 4 s.
   A segunda abertura é rápida. Isso **não existe em produção**.
2. **Sem skeleton:** nenhuma rota tinha `loading.tsx`, então a tela ficava em branco até o servidor terminar.
3. **Sem aquecimento:** as rotas dos módulos só eram buscadas no clique.

## Medições em produção (`npm run build && npm start`, máquina local)

| Rota | TTFB 1ª vez | TTFB 2ª vez |
|---|---|---|
| `/` | 82 ms | 25 ms |
| `/login` | 10 ms | 17 ms |
| `/cadastro` | 56 ms | — |
| `/politicas` | 64 ms | 10 ms |
| `/dashboard` (sem sessão) | 35 ms (redireciona para o login) | — |

As rotas de `/dashboard/*` só abrem com sessão, e o atalho `PROTOTYPE_BYPASS_AUTH` só existe fora de produção, por segurança.
Por isso **não foi possível medir o dashboard em produção sem uma conta real**. Para medir quando houver conta de teste:
`npm run build && npm start`, entrar e abrir cada módulo com o painel Network aberto (ou `curl` com o cookie de sessão).

## Consultas do servidor no caminho de cada abertura do dashboard

| Consulta | Onde | Observação |
|---|---|---|
| `auth.getClaims()` | `src/lib/supabase/session.ts` | Valida o JWT localmente; só vai à rede quando precisa renovar a sessão |
| `profiles` (nome, tema) | `src/app/(app)/layout.tsx` | 1 consulta por chave primária |
| `profiles` (plano) | `src/lib/plan-server.ts` | Roda em paralelo com a anterior; cai para `free` se a coluna não existir |

As telas dos módulos usam dados de exemplo (`src/mocks/`), então **não fazem consulta nenhuma** hoje. Quando forem ligadas ao
Supabase, as consultas que merecem atenção são as de `src/features/tasks/queries.ts` (quadros com tarefas, etiquetas e anexos).

## O que foi feito

- `loading.tsx` com skeleton para cada rota do dashboard (`PageSkeleton`), no mesmo ritmo visual da tela real. O skeleton só
  aparece depois de 200 ms (atraso de animação em CSS, sem timers), então navegações rápidas nunca mostram nada piscando.
- O carregamento da primeira sessão (layout do app) continua com a tela do logotipo, também só depois de ~300 ms.
- Pré-busca (`router.prefetch`) de todas as rotas de módulos quando o navegador está ocioso. Em produção, os `Link` já
  pré-buscam ao entrar na tela; com `loading.tsx` a pré-busca passa a cobrir também as rotas dinâmicas.
