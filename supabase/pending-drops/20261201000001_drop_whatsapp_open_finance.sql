-- PENDING, NOT APPLIED. This file lives outside supabase/migrations on purpose: nothing runs it.
-- WhatsApp and Open Finance were removed from the product on 2026-11-03 (docs/REMOVAL-WHATSAPP-OPENFINANCE.md). No code reads or
-- writes the objects below anymore. To drop them for good, move this file into supabase/migrations/ (keep or bump the timestamp so
-- it sorts after the latest applied migration) and apply it with an explicit decision from the owner.
--
-- Destructive: the rows (if any) are lost. whatsapp_links was never populated by the app (the linking flow was never built).

drop table if exists public.whatsapp_links;

-- Unused preference column (the app no longer sends it; the default is false).
alter table public.notification_preferences drop column if exists whatsapp_enabled;

-- Not dropped here on purpose:
--  * transactions.source = 'open_finance' stays an allowed value of the check constraint (it is harmless and a column rewrite is not needed);
--  * audit_log.actor keeps 'whatsapp' in its check so old audit rows stay valid;
--  * the admin RPCs keep returning whatsapp_linked (always false); only a new migration may change them, never an edited one.
