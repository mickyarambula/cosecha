-- Contact emails + preferred SKUs per customer/vendor (their item, not ours).

alter table customers add column if not exists email text;
alter table suppliers add column if not exists email text;

update customers set email = 'compras@northgatemarkets.example' where name = 'Northgate Markets' and email is null;
update customers set email = 'samuel@papayasandmore.example' where name = 'Papayas & More' and email is null;
update customers set email = 'ap@carrifoods.example' where name = 'Carrifoods USA Corp' and email is null;
update customers set email = 'orders@alpinefresh.example' where name = 'Alpine Fresh' and email is null;
update customers set email = 'buyers@freshmex.example' where name = 'Freshmex USA' and email is null;
update customers set email = 'jorge@mercadocentral.example' where code = 'CLI-001' and email is null;
update customers set email = 'paula@freshhub.example' where code = 'CLI-002' and email is null;
update customers set email = 'elena@retailvalle.example' where code = 'CLI-003' and email is null;

update suppliers set email = 'marta@huertalosalamos.example' where code = 'PRO-001' and email is null;
update suppliers set email = 'luis@campoverde.example' where code = 'PRO-002' and email is null;
update suppliers set email = 'ana@berriespacifico.example' where code = 'PRO-003' and email is null;
update suppliers set email = 'samuel@papayasandmore.example' where name ilike '%papaya%' and email is null;

create table if not exists party_skus (
  id serial primary key,
  party_kind text not null check (party_kind in ('customer', 'vendor')),
  party_id integer not null,
  pack_style_id integer not null references pack_styles(id) on delete cascade,
  alias_sku text,
  notes text,
  unique (party_kind, party_id, pack_style_id)
);

create index if not exists party_skus_party_idx on party_skus (party_kind, party_id);

insert into party_skus (party_kind, party_id, pack_style_id, alias_sku, notes)
select 'customer', c.id, 7, 'NGM-PAP-10CT', 'Count Northgate always orders'
from customers c
where c.name = 'Northgate Markets'
  and exists (select 1 from pack_styles where id = 7)
  and not exists (
    select 1 from party_skus ps where ps.party_kind = 'customer' and ps.party_id = c.id and ps.pack_style_id = 7
  );

insert into party_skus (party_kind, party_id, pack_style_id, alias_sku, notes)
select 'vendor', s.id, ps.id, ps.sku_code, 'Grown / packed by this vendor'
from suppliers s
join pack_styles ps on ps.product_id = 6
where s.name ilike '%papaya%'
  and not exists (
    select 1 from party_skus x
    where x.party_kind = 'vendor' and x.party_id = s.id and x.pack_style_id = ps.id
  );
