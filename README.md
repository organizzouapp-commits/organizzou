This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Plans and billing (Asaas)

Organizzou has two plans: **Gratuito** and **Pro**. Pro is R$ 5,00 in the first month and then R$ 24,90 a month, or R$ 250,00 a year (R$ 20,83 a month, R$ 48,80 less than twelve monthly payments). Payments go through [Asaas](https://www.asaas.com) with card, Pix or boleto.

| | Gratuito | Pro |
|---|---|---|
| Tarefas | 1 quadro, até 3 listas | ilimitado |
| Finanças | lançamentos manuais | contas fixas e parceladas, metas, orçamento, gráficos |
| Assistente | não tem | conversa, ações e voz, 200 mensagens por dia |
| Agenda, Rotina, Treinos, Dieta, Estudos, Notas, Metas, Diário, Cofre | bloqueados (os dados ficam guardados) | liberados |
| Avisos | lembretes de tarefas | todos |

The rules live in one file, `src/lib/plans.ts` (limits, features, `getEntitlements`, `canUse`, the 3-day grace after a failed renewal; admins are always Pro). The screens only show what the server enforces: `persistRows` (`src/features/persist/gate.ts`), the task actions (boards and lists), the notification dispatcher and the assistant route all ask the same module. A lapsed plan never deletes anything: a locked module shows a locked screen and the data comes back with Pro.

### How a payment flows

1. **Plano e cobrança** (Configurações) opens the checkout: plan (Mensal or Anual), CPF/CNPJ of the payer, and how to pay. The CPF/CNPJ is sent to our server only to open the charge, stored in `billing_customers` (no policy for the browser, readable only with the secret key) and never logged.
2. `POST /api/billing/checkout` creates the Asaas customer and a subscription at the regular price. **Pix** shows the QR code and the copy-and-paste text inside the app, counts down the expiry and checks every few seconds. **Cartão** and **boleto** go to the Asaas-hosted page, so card data never touches our server, and come back to the plan tab with a "pagamento pendente" banner.
3. Asaas calls `POST /api/webhooks/asaas`. `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` turn Pro on until the end of the paid period (`profiles.plan`, `profiles.plan_until`); `PAYMENT_OVERDUE` opens a 3-day grace; `PAYMENT_REFUNDED` ends Pro; `SUBSCRIPTION_DELETED` / `SUBSCRIPTION_INACTIVATED` end the recurrence and Pro runs until `plan_until`. Every event id is stored once in `billing_events`, so a repeated delivery changes nothing and a failed one is retried.
4. Cancel (`POST /api/billing/cancel`) ends the recurrence at the end of the paid period. Monthly and annual can be switched (`POST /api/billing/change-plan`) from the next charge on.

**The R$ 5,00 first month** (`LAUNCH_PRICE_CENTS` in `src/lib/plans.ts`; Asaas refuses charges below R$ 5,00). Asaas has one `value` per subscription and, in the pages of its documentation read for this work, no way to make only the first charge cheaper. So the subscription is created at the regular value and the first pending charge it generates is edited to the launch price (`PUT /v3/payments/{id}`, allowed while a charge is pending). If that edit fails the subscription is deleted again and nothing is charged. The launch price is for someone's first paid month ever.

**Minimum charge.** Asaas refuses any charge below R$ 5,00, so `MIN_CHARGE_CENTS = 500` is checked for the first charge and the subscription value before Asaas is called; a lower value fails fast with a clear message and nothing is sent.

**When a checkout fails after the subscription exists** (for example the launch price cannot be applied), the subscription is deleted at Asaas with three attempts and a short backoff ("not found" counts as deleted). If it still cannot be deleted it is **not swallowed**: an `asaas_orphan` error is logged (operation, status and the Asaas id only), the id is recorded in `billing_events` (event `ORPHAN_SUBSCRIPTION`, open while `processed_at` is empty; no migration) and the person is told to contact support instead of that nothing was charged. The next checkout of that person first cleans the orphan, so a retry never creates a duplicate. In **Admin > Assinaturas**, "Pendentes de limpeza" lists them with a "Tentar apagar de novo" button (audit-logged).

### Configure Asaas (sandbox first)

1. Create a sandbox account at https://sandbox.asaas.com and an API key (Integrações > Chave de API).
2. Set in Vercel (Preview first): `ASAAS_API_KEY` (the sandbox key), `ASAAS_ENV=sandbox`, `ASAAS_WEBHOOK_TOKEN` (a long random value you invent, never the API key) and `SUPABASE_SECRET_KEY` (already used by the admin). `ASAAS_BASE_URL` is optional. The names are in `.env.example`; no value is ever in the code.
3. In Asaas > Integrações > Webhooks create a webhook with the URL `https://organizzou.com/api/webhooks/asaas`, the token from `ASAAS_WEBHOOK_TOKEN` as the authentication token (Asaas sends it in the `asaas-access-token` header), API version v3, and the events for cobranças (payments) and assinaturas (subscriptions).
4. Apply the migrations below, one at a time, in this order.
5. Test in the sandbox: a Pix (the sandbox lets you simulate the payment), a card, a boleto, a failed renewal, a cancel and the switch to annual.
6. Production: new key, `ASAAS_ENV=production`, a production webhook with its own token, redeploy.

### Migrations for billing (prepared, not applied)

- `20261118000001_billing.sql`: `billing_customers` (the CPF/CNPJ, no policy at all), `subscriptions`, `billing_invoices` (own-read only) and `billing_events`. Additive only.
- `20261118000003_admin_billing.sql`: the admin reader behind Admin > Assinaturas (needs the first one).

Until they are applied the app treats everyone as Free, the plan screen still opens, and the admin page says what is missing.

### What could not be checked without Asaas credentials

The exact shape of the customer creation call, the production base URL (`https://api.asaas.com/v3`), whether editing the first charge leaves the next ones untouched, how the card is kept for the next charges when the first one is paid on the hosted page, and the plan change (`PUT /subscriptions/{id}`). All of them are isolated in `src/lib/billing/asaas.ts` and `service.ts` with tests against a fake; check them in the sandbox before going live.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
