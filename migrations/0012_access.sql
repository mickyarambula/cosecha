-- Miguel is the operator. New logins wait until an admin grants modules.

alter table staff add column if not exists status text not null default 'pending';
alter table staff add column if not exists modules jsonb not null default '[]'::jsonb;

update staff
set name = 'Miguel',
    email = 'miguelarambulam@gmail.com',
    role = 'admin',
    status = 'active',
    modules = '["orders","warehouse","contacts","finance","reports","settings"]'::jsonb
where lower(coalesce(email, '')) in ('juan@pleinproduce.com', 'miguelarambulam@gmail.com')
   or name ilike 'Juan Mercado';

insert into staff (name, email, role, status, modules)
select 'Miguel',
       'miguelarambulam@gmail.com',
       'admin',
       'active',
       '["orders","warehouse","contacts","finance","reports","settings"]'::jsonb
where not exists (
  select 1 from staff where lower(coalesce(email, '')) = 'miguelarambulam@gmail.com'
);
