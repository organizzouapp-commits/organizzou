# Relatório de QA (smoke sweep)

Gerado por `tests/e2e/smoke.spec.ts` em 2026-11-02. Rotas: 21, viewports: 1440x900 e 390x844, até 60 cliques por tela. Modo dev com `PROTOTYPE_BYPASS_AUTH=1` (o protótipo usa dados de exemplo; não há login real ainda).

| Severidade | Rota | Viewport | Elemento | Problema |
|---|---|---|---|---|
| média | /cadastro | desktop | button "1Crie sua conta agora" | clique não fez nada (sem URL, DOM ou rede) |
| média | /login | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| média | /recuperar-senha | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| média | /recuperar-senha/nova-senha | desktop | button "1Veja seu dia organizado" | clique não fez nada (sem URL, DOM ou rede) |
| baixa | /cadastro | desktop | button "Ocultar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /cadastro | desktop | button "Ocultar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /cadastro | desktop | button "Continuar com Google" | console.warning: The powerPreference option is currently ignored when calling requestAdapter() on Windows. See https://crbug.com/369219127 |
| baixa | /cadastro | desktop | button "Continuar com Google" | console.warning: No available adapters. |
| baixa | /login | desktop | button "Continuar com Google" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /login | desktop | button "Continuar com Google" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /login | desktop | button "Continuar com Google" | console.warning: The powerPreference option is currently ignored when calling requestAdapter() on Windows. See https://crbug.com/369219127 |
| baixa | /login | desktop | button "Continuar com Google" | console.warning: No available adapters. |
| baixa | /recuperar-senha | desktop | a "Voltar para entrar" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /recuperar-senha | desktop | a "Voltar para entrar" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
| baixa | /recuperar-senha/nova-senha | desktop | button "Ocultar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-escuro.svg was preloaded using link preload but not used within a few seconds from |
| baixa | /recuperar-senha/nova-senha | desktop | button "Ocultar senha" | console.warning: The resource http://localhost:3100/brand/animada/organizzou-logo-carregamento-claro.svg was preloaded using link preload but not used within a few seconds from  |
