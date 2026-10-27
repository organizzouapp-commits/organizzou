# Configurar o Organizzou em outro computador (Windows)

Passo a passo para continuar o projeto em um computador novo. Leva cerca de 15 minutos.

## 1. Instalar as ferramentas

1. **Node.js LTS**: baixe em <https://nodejs.org> (botão "LTS") e instale com as opções padrão. Depois, abra um terminal novo e confira:
   ```powershell
   node -v
   npm -v
   ```
2. **Git**: <https://git-scm.com/download/win>, instalação padrão.
3. **VS Code**: <https://code.visualstudio.com>.
4. **Claude Code**: instale a extensão "Claude Code" no VS Code (aba Extensões) e entre com a sua conta.

## 2. Baixar o projeto

No terminal (pode ser o do VS Code), escolha uma pasta e rode:

```powershell
git clone https://github.com/organizzouapp-commits/organizzou.git
cd organizzou
code .
```

Na primeira vez o Git abre uma janela do navegador pedindo para entrar no GitHub. Autorize com a conta que tem acesso ao repositório.

O código já está na branch `main`. As branches `phase-1`, `phase-2`, `prototype` e `layout-v3` guardam o histórico de cada etapa.

## 3. Instalar as dependências

```powershell
npm install
```

## 4. Criar o `.env.local`

O arquivo `.env.local` guarda as chaves e **nunca vai para o GitHub**. Crie-o a partir do modelo:

```powershell
copy .env.example .env.local
```

Abra o `.env.local` e preencha **somente** estes dois valores, que ficam no painel do Supabase (<https://supabase.com/dashboard>, projeto **Organizzou**, em *Project Settings → API Keys / Data API*):

| Variável | O que copiar |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | O *Project URL*: `https://iqxbcvarozgmtvosnofw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | A *publishable key* (começa com `sb_publishable_`) |

Deixe as demais como estão:

- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- `NEXT_PUBLIC_COOKIE_DOMAIN` vazio (só se usa quando o site de marketing existir)
- `SUPABASE_SERVICE_ROLE_KEY` **vazio**. A chave secreta não é necessária para rodar o app. Nunca a cole em chats, commits ou arquivos que vão para o GitHub.

## 5. Rodar o app

```powershell
npm run dev
```

Abra <http://localhost:3000>. Para criar uma conta, use `/cadastro`; para entrar, `/login`.

Comandos úteis:

```powershell
npm run lint          # verifica o código
npx tsc --noEmit      # verifica os tipos
npm test              # testes unitários
npm run build         # build de produção
```

## 6. Migrations e CLI do Supabase (só se precisar)

Para **rodar o app não é preciso** usar a CLI: o banco do projeto já está pronto. Só use estes passos se for criar ou aplicar uma migration nova:

```powershell
npx supabase login
npx supabase link --project-ref iqxbcvarozgmtvosnofw
```

- `login` abre o navegador: entre com a conta do Supabase dona do projeto e cole o código de verificação no terminal.
- `link` pede a **senha do banco** (a que foi definida ao criar o projeto). Ela fica só na sua máquina.

Depois, para aplicar migrations e atualizar os tipos:

```powershell
npx supabase db push
npx supabase gen types typescript --linked
```

No Windows, não use `>` do PowerShell para salvar os tipos (ele grava em UTF-16). Salve a saída em `src/lib/supabase/types.ts` com o editor, ou peça ao Claude Code.

As migrations estão em `supabase/migrations/` e a configuração de autenticação em `supabase/config.toml` (`npx supabase config push` envia essa configuração).

## 7. MCP do shadcn (componentes)

O arquivo `.mcp.json`, que já vem no repositório, configura o servidor MCP do shadcn. Ao abrir o projeto no Claude Code, aprove o servidor `shadcn` quando ele perguntar. Não é preciso instalar nada além do Node: ele roda com `npx shadcn@latest mcp`.

## 8. Antes de começar a trabalhar

- Leia `CLAUDE.md` e `docs/design-system/DESIGN-SYSTEM.md`: as regras de design (6 cores, cartões, telas de acesso) valem para tudo.
- `docs/PROTOTYPE.md` explica como rodar o protótipo com dados de exemplo e os testes de navegador em `tests/e2e/`.
- Para enviar o que você fez:
  ```powershell
  git add .
  git commit -m "descreva a mudança"
  git push
  ```
- Para pegar o que foi feito no outro computador: `git pull`.

## Problemas comuns

- **`npm install` falha**: confira `node -v` (use a versão LTS) e abra um terminal novo depois de instalar o Node.
- **A tela abre mas o login dá erro**: revise as duas variáveis do `.env.local` e reinicie o `npm run dev` (ele só lê o arquivo ao iniciar).
- **Porta 3000 ocupada**: feche o outro `npm run dev` ou rode `npm run dev -- -p 3001` (e use `http://localhost:3001`; adicione também `http://localhost:3001/**` em *Authentication → URL Configuration* do Supabase).
- **A pasta `imagens/` não veio**: ela guarda os originais das imagens e não é versionada. O app usa as cópias de `public/`, então nada quebra.
