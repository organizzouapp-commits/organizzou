# Relatório de QA (smoke sweep)

Gerado por `tests/e2e/smoke.spec.ts` em 2026-10-28. Rotas: 21, viewports: 1440x900 e 390x844, até 25 cliques por tela. Modo dev com `PROTOTYPE_BYPASS_AUTH=1` (o protótipo usa dados de exemplo; não há login real ainda).

| Severidade | Rota | Viewport | Elemento | Problema |
|---|---|---|---|---|
| alta | /dashboard/ajuda | mobile | (load) | exceção: modules is not defined |
| alta | /dashboard/ajuda | mobile | button "Back" | exceção: modules is not defined |
| alta | /politicas | mobile | a "Voltar ao início" | console.error: Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client. Consider using templa |
| média | / | mobile | a "Termos de uso" | clique não fez nada (sem URL, DOM ou rede) |
| média | /cadastro | desktop | button "1Crie sua conta agora" | clique não fez nada (sem URL, DOM ou rede) |
| média | /login | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| média | /recuperar-senha | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| média | /recuperar-senha/nova-senha | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| média | /recuperar-senha/nova-senha | desktop | a "Termos de uso" | clique não fez nada (sem URL, DOM ou rede) |
| baixa | / | mobile | a "Política de privacidade" | não foi possível clicar (coberto/instável) |
| baixa | /cadastro | desktop | button "Mostrar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /cadastro | desktop | button "Mostrar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /cadastro | desktop | button "Continuar com Google" | console.warning: The powerPreference option is currently ignored when calling requestAdapter() on Windows. See https://crbug.com/369219127 |
| baixa | /cadastro | desktop | button "Continuar com Google" | console.warning: No available adapters. |
| baixa | /dashboard | mobile | a "Abrir Gasto de hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard | mobile | button "Você gastou 12% menos com restaurantes e" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/agenda | mobile | a "Agenda" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/ajuda | mobile | button "Reload" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/cofre | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/configuracoes | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/configuracoes | mobile | button "Gastei R$ 45 no mercado" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/diario | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/financas | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/financas | mobile | button "Gastei R$ 45 no mercado" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/metas | mobile | button "Organização" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/metas | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/perfil | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/perfil | mobile | button "Agenda" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/perfil | mobile | button "Gastei R$ 45 no mercado" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/rotina | mobile | button "Diminuir Beber 2,5 litros de água" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/tarefas | mobile | a "Tarefas" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/treinos | mobile | button "Finalizar treino" | não foi possível clicar (coberto/instável) |
| baixa | /login | desktop | a "Criar conta" | console.warning: The powerPreference option is currently ignored when calling requestAdapter() on Windows. See https://crbug.com/369219127 |
| baixa | /login | desktop | a "Criar conta" | console.warning: No available adapters. |
| baixa | /login | desktop | a "Política de privacidade" | não foi possível clicar (coberto/instável) |
| baixa | /politicas | desktop | a "Cookies" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /politicas | desktop | a "Cookies" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /recuperar-senha | desktop | a "Voltar para entrar" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /recuperar-senha | desktop | a "Voltar para entrar" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /recuperar-senha/nova-senha | desktop | button "Ocultar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /recuperar-senha/nova-senha | desktop | button "Ocultar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /recuperar-senha/nova-senha | desktop | a "Política de privacidade" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /recuperar-senha/nova-senha | desktop | a "Política de privacidade" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /recuperar-senha/nova-senha | desktop | a "Política de privacidade" | não foi possível clicar (coberto/instável) |
