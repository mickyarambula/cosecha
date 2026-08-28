-- Public share links (invoices, purchase orders, sales orders, vendor portal)
-- stop being sequential ids. Old /doc/* and /portal/* links break — expected,
-- they were guessable. No pgcrypto dependency: two md5 rounds over
-- random()+clock_timestamp() give a 64-hex-char token, plenty for this.

alter table invoices add column if not exists share_token text;
alter table purchase_orders add column if not exists share_token text;
alter table sales_orders add column if not exists share_token text;

update invoices set share_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || id::text)
  where share_token is null;
update purchase_orders set share_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || id::text)
  where share_token is null;
update sales_orders set share_token = md5(random()::text || clock_timestamp()::text || id::text) || md5(random()::text || id::text)
  where share_token is null;

alter table invoices alter column share_token set not null;
alter table purchase_orders alter column share_token set not null;
alter table sales_orders alter column share_token set not null;

alter table invoices alter column share_token set default (
  md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)
);
alter table purchase_orders alter column share_token set default (
  md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)
);
alter table sales_orders alter column share_token set default (
  md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)
);

create unique index if not exists invoices_share_token_key on invoices (share_token);
create unique index if not exists purchase_orders_share_token_key on purchase_orders (share_token);
create unique index if not exists sales_orders_share_token_key on sales_orders (share_token);
