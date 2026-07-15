-- seed.sql — admin iniziali (modifica le email prima di usarlo in produzione)
insert into admin_allowlist(email) values ('michele.sottocasa@lexroom.ai') on conflict do nothing;
