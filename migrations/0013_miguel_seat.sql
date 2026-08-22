-- Keep Miguel on the admin seat even if a preview login linked first.

update staff
set name = 'Miguel',
    email = 'miguelarambulam@gmail.com',
    role = 'admin',
    status = 'active',
    modules = '["orders","warehouse","contacts","finance","reports","settings"]'::jsonb
where id = (select min(id) from staff where role = 'admin');
