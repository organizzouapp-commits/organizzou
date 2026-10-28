# Relatório de QA (smoke sweep)

Gerado por `tests/e2e/smoke.spec.ts` em 2026-10-28. Rotas: 21, viewports: 1440x900 e 390x844, até 25 cliques por tela. Modo dev com `PROTOTYPE_BYPASS_AUTH=1` (o protótipo usa dados de exemplo; não há login real ainda).

| Severidade | Rota | Viewport | Elemento | Problema |
|---|---|---|---|---|
| média | / | mobile | a "Termos de uso" | clique não fez nada (sem URL, DOM ou rede) |
| média | /cadastro | desktop | button "1Crie sua conta agora" | clique não fez nada (sem URL, DOM ou rede) |
| média | /login | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| média | /recuperar-senha | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| baixa | / | mobile | a "Política de privacidade" | não foi possível clicar (coberto/instável) |
| baixa | /cadastro | desktop | (load) | console.warning: The powerPreference option is currently ignored when calling requestAdapter() on Windows. See https://crbug.com/369219127 |
| baixa | /cadastro | desktop | (load) | console.warning: No available adapters. |
| baixa | /cadastro | desktop | button "Mostrar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /cadastro | desktop | button "Mostrar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /cadastro | desktop | a "Entrar" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard | desktop | (load) | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /dashboard | desktop | (load) | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /dashboard/ajuda | mobile | input "(sem nome)" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/ajuda | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/ajuda | mobile | button "Gastei R$ 45 no mercado" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/cofre | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/cofre | mobile | button "Agenda" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/configuracoes | mobile | input "(sem nome)" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/configuracoes | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/configuracoes | mobile | button "Gastei R$ 45 no mercado" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/diario | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/dieta | mobile | button "Vida" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/dieta | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/financas | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/metas | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/perfil | mobile | input "(sem nome)" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/perfil | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/treinos | mobile | button "Finalizar treino" | não foi possível clicar (coberto/instável) |
| baixa | /login | desktop | a "Criar conta" | não foi possível clicar (coberto/instável) |
| baixa | /politicas | desktop | a "Cookies" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /politicas | desktop | a "Cookies" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /recuperar-senha | desktop | (load) | console.warning: The powerPreference option is currently ignored when calling requestAdapter() on Windows. See https://crbug.com/369219127 |
| baixa | /recuperar-senha | desktop | (load) | console.warning: No available adapters. |
| baixa | /recuperar-senha | desktop | a "Voltar para entrar" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /recuperar-senha | desktop | a "Voltar para entrar" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /recuperar-senha/nova-senha | desktop | button "Mostrar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /recuperar-senha/nova-senha | desktop | button "Mostrar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
