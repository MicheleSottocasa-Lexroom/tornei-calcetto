-- 0006_reminder_5min.sql
-- Secondo promemoria partita (~5 minuti prima): flag dedicato accanto a reminder_sent (~30 min).
alter table matches add column if not exists reminder_5_sent boolean not null default false;
