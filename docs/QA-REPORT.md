# Relatório de QA (smoke sweep)

Gerado por `tests/e2e/smoke.spec.ts` em 2026-10-28. Rotas: 21, viewports: 1440x900 e 390x844, até 25 cliques por tela. Modo dev com `PROTOTYPE_BYPASS_AUTH=1` (o protótipo usa dados de exemplo; não há login real ainda).

| Severidade | Rota | Viewport | Elemento | Problema |
|---|---|---|---|---|
| alta | /dashboard | mobile | a "Responder e-mails pendentesAtrasada · On" → document (912px > 390px) | overflow horizontal |
| alta | /dashboard | mobile | a "Marcar consulta no dentistaAtrasada · Ho" → document (912px > 390px) | overflow horizontal |
| média | /cadastro | desktop | button "1Crie sua conta agora" | clique não fez nada (sem URL, DOM ou rede) |
| média | /dashboard/agenda | desktop | button "Hoje" | clique não fez nada (sem URL, DOM ou rede) |
| média | /login | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| média | /recuperar-senha | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| média | /recuperar-senha/nova-senha | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| baixa | /cadastro | desktop | button "Continuar com Google" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /cadastro | desktop | button "Continuar com Google" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /cadastro | desktop | a "Entrar" | não foi possível clicar (coberto/instável) |
| baixa | /cadastro | desktop | button "iqxbcvarozgmtvosnofw.supabase.co" | console.warning: The powerPreference option is currently ignored when calling requestAdapter() on Windows. See https://crbug.com/369219127 |
| baixa | /cadastro | desktop | button "iqxbcvarozgmtvosnofw.supabase.co" | console.warning: No available adapters. |
| baixa | /cadastro | desktop | a "Política de privacidade" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /cadastro | desktop | a "Política de privacidade" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /cadastro | desktop | a "Política de privacidade" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard | desktop | a "Abrir Hábitos" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard | mobile | button "Buscar" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/ajuda | mobile | input "(sem nome)" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/ajuda | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/ajuda | mobile | button "Gastei R$ 45 no mercado" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/cofre | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/diario | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/dieta | mobile | button "Vida" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/financas | mobile | input "(sem nome)" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/financas | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/metas | mobile | input "(sem nome)" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/metas | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/metas | mobile | button "Opções de Passar na 1ª fase da OAB" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/perfil | desktop | a "Perfil" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/perfil | mobile | button "Hoje" | não foi possível clicar (coberto/instável) |
| baixa | /dashboard/tarefas | desktop | button "Quadro" | não foi possível clicar (coberto/instável) |
| baixa | /login | desktop | button "Continuar com Google" | não foi possível clicar (coberto/instável) |
| baixa | /recuperar-senha/nova-senha | desktop | button "Ocultar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /recuperar-senha/nova-senha | desktop | button "Ocultar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
