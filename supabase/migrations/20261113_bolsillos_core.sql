-- ============================================================================
-- Bolsillos múltiples — núcleo (migración bolsillos_core)
-- Diseño: docs/superpowers/specs/2026-11-13-bolsillos-multiples-design.md
-- Reversión: supabase/rollback/2026-11-13-bolsillos-down.sql
--
-- Aditiva y compatible con el código ya desplegado: las inserciones que no
-- traen bolsillo_id caen en el bolsillo personal predeterminado (trigger).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla bolsillos
-- ---------------------------------------------------------------------------
create table public.bolsillos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  kind             text not null check (kind in ('personal', 'business')),
  color            text not null default '#3b7bf6' check (char_length(color) between 3 and 20),
  icon             text not null default '👛' check (char_length(icon) between 1 and 16),
  currency         text not null default 'COP' check (char_length(currency) = 3),
  initial_balance  numeric(14,2) not null default 0 check (initial_balance >= 0),
  is_default       boolean not null default false,
  position         integer not null default 0,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint bolsillos_default_es_personal check (not is_default or kind = 'personal')
);

comment on table public.bolsillos is 'Espacios financieros aislados del usuario (personal / negocio). Cada uno con su caja, movimientos y categorías.';
comment on column public.bolsillos.is_default is 'Bolsillo "Ingresos personales" creado al registrarse: no se puede borrar, archivar ni cambiar de tipo.';
comment on column public.bolsillos.initial_balance is 'Saldo con el que arranca la caja. En negocios cuenta como capital invertido inicial.';

create unique index bolsillos_un_predeterminado_por_usuario on public.bolsillos (user_id) where is_default;
create index bolsillos_user_id_idx on public.bolsillos (user_id, position);

create trigger set_updated_at before update on public.bolsillos
  for each row execute function public.handle_updated_at();

alter table public.bolsillos enable row level security;
create policy bolsillos_select_own on public.bolsillos for select using (user_id = (select auth.uid()));
create policy bolsillos_insert_own on public.bolsillos for insert with check (user_id = (select auth.uid()));
create policy bolsillos_update_own on public.bolsillos for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy bolsillos_delete_own on public.bolsillos for delete using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.bolsillos to authenticated;

-- El predeterminado no se borra, no se archiva y no cambia de tipo. Al borrar
-- la cuenta (cascade desde auth.users) el usuario ya no existe y se permite.
-- security definer: necesita leer auth.users (authenticated no puede); solo
-- consulta y lanza errores. IF anidados: PL/pgSQL no corta el AND.
create or replace function public.proteger_bolsillo_predeterminado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    if old.is_default then
      if exists (select 1 from auth.users where id = old.user_id) then
        raise exception 'El bolsillo personal predeterminado no se puede eliminar' using errcode = '22023';
      end if;
    end if;
    return old;
  end if;

  if old.is_default then
    if new.archived_at is not null or new.kind <> 'personal' or not new.is_default then
      raise exception 'El bolsillo personal predeterminado solo se puede renombrar o cambiar de color/ícono' using errcode = '22023';
    end if;
  elsif new.is_default then
    raise exception 'No se puede marcar otro bolsillo como predeterminado' using errcode = '22023';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'No se puede cambiar el dueño de un bolsillo' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke execute on function public.proteger_bolsillo_predeterminado() from public, anon, authenticated;

create trigger bolsillos_proteger_predeterminado before update or delete on public.bolsillos
  for each row execute function public.proteger_bolsillo_predeterminado();

-- ---------------------------------------------------------------------------
-- 2. Categorías por defecto según el tipo de bolsillo (un solo lugar)
-- ---------------------------------------------------------------------------
create or replace function public.sembrar_categorias(p_user uuid, p_bolsillo uuid, p_kind text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_kind = 'business' then
    insert into public.categorias (user_id, bolsillo_id, name, color, kind, is_default) values
      (p_user, p_bolsillo, 'Ventas',             '#2A9D8F', 'income',  true),
      (p_user, p_bolsillo, 'Servicios',          '#81B29A', 'income',  true),
      (p_user, p_bolsillo, 'Abonos de clientes', '#4a4fd0', 'income',  true),
      (p_user, p_bolsillo, 'Mercancía',          '#2B2D42', 'expense', true),
      (p_user, p_bolsillo, 'Arriendo',           '#E76F51', 'expense', true),
      (p_user, p_bolsillo, 'Servicios públicos', '#F4A261', 'expense', true),
      (p_user, p_bolsillo, 'Transporte',         '#81B29A', 'expense', true),
      (p_user, p_bolsillo, 'Nómina',             '#E07A5F', 'expense', true),
      (p_user, p_bolsillo, 'Comisiones',         '#c98a1c', 'expense', true),
      (p_user, p_bolsillo, 'Pérdidas',           '#787774', 'expense', true);
  else
    insert into public.categorias (user_id, bolsillo_id, name, color, kind, is_default) values
      (p_user, p_bolsillo, 'Vivienda',       '#2B2D42', 'expense', true),
      (p_user, p_bolsillo, 'Servicios',      '#E76F51', 'expense', true),
      (p_user, p_bolsillo, 'Alimentación',   '#F4A261', 'expense', true),
      (p_user, p_bolsillo, 'Suscripciones',  '#E07A5F', 'expense', true),
      (p_user, p_bolsillo, 'Transporte',     '#81B29A', 'expense', true),
      (p_user, p_bolsillo, 'Antojos',        '#787774', 'expense', true),
      (p_user, p_bolsillo, 'Salario',        '#2A9D8F', 'income',  true),
      (p_user, p_bolsillo, 'Ingreso extra',  '#81B29A', 'income',  true),
      (p_user, p_bolsillo, 'Rendimientos',   '#F4A261', 'income',  true);
  end if;
end;
$$;
revoke execute on function public.sembrar_categorias(uuid, uuid, text) from public, anon;
grant execute on function public.sembrar_categorias(uuid, uuid, text) to authenticated;

-- Bolsillos creados por el usuario se siembran solos; el predeterminado lo
-- siembra handle_new_user (y los usuarios existentes ya tienen categorías).
create or replace function public.sembrar_categorias_bolsillo_nuevo()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not new.is_default then
    perform public.sembrar_categorias(new.user_id, new.id, new.kind);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. bolsillo_id en categorías, ingresos y gastos (+ método de pago en ingresos)
-- ---------------------------------------------------------------------------
alter table public.categorias add column bolsillo_id uuid references public.bolsillos(id) on delete cascade;
alter table public.ingresos   add column bolsillo_id uuid references public.bolsillos(id);
alter table public.gastos     add column bolsillo_id uuid references public.bolsillos(id);
alter table public.ingresos   add column payment_method text check (payment_method is null or char_length(payment_method) <= 60);

-- Backfill: un "Ingresos personales" por usuario existente y todo lo
-- histórico asignado a él. Sin disparar auditoría ni tocar updated_at.
insert into public.bolsillos (user_id, name, kind, color, icon, is_default)
select u.id, 'Ingresos personales', 'personal', '#3b7bf6', '👤', true
from auth.users u
where not exists (select 1 from public.bolsillos b where b.user_id = u.id and b.is_default);

alter table public.categorias disable trigger set_updated_at;
alter table public.ingresos   disable trigger set_updated_at;
alter table public.ingresos   disable trigger audit_incomes;
alter table public.gastos     disable trigger set_updated_at;
alter table public.gastos     disable trigger audit_expenses;

update public.categorias c set bolsillo_id = b.id from public.bolsillos b where b.user_id = c.user_id and b.is_default and c.bolsillo_id is null;
update public.ingresos   i set bolsillo_id = b.id from public.bolsillos b where b.user_id = i.user_id and b.is_default and i.bolsillo_id is null;
update public.gastos     g set bolsillo_id = b.id from public.bolsillos b where b.user_id = g.user_id and b.is_default and g.bolsillo_id is null;

alter table public.categorias enable trigger set_updated_at;
alter table public.ingresos   enable trigger set_updated_at;
alter table public.ingresos   enable trigger audit_incomes;
alter table public.gastos     enable trigger set_updated_at;
alter table public.gastos     enable trigger audit_expenses;

alter table public.categorias alter column bolsillo_id set not null;
alter table public.ingresos   alter column bolsillo_id set not null;
alter table public.gastos     alter column bolsillo_id set not null;

create index categorias_bolsillo_idx on public.categorias (bolsillo_id, kind) where deleted_at is null;
create index ingresos_user_bolsillo_fecha_idx on public.ingresos (user_id, bolsillo_id, date);
create index gastos_user_bolsillo_fecha_idx on public.gastos (user_id, bolsillo_id, date);

create trigger bolsillos_sembrar_categorias after insert on public.bolsillos
  for each row execute function public.sembrar_categorias_bolsillo_nuevo();

-- ---------------------------------------------------------------------------
-- 4. Integridad: bolsillo propio (o el predeterminado si no viene), no
--    archivado al registrar, y categoría del MISMO bolsillo.
-- ---------------------------------------------------------------------------
-- Nota: PL/pgSQL NO corta la evaluación de `a and new.campo`: si la tabla no
-- tiene ese campo falla con 42703 aunque `a` sea falso. Por eso cada tabla
-- tiene su rama y nunca se lee un campo que la tabla no tenga.
create or replace function public.assert_owned_refs()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bolsillo public.bolsillos;
begin
  if TG_TABLE_NAME = 'ahorros' then
    if new.goal_id is not null
       and not exists (select 1 from metas where id = new.goal_id and user_id = new.user_id) then
      raise exception 'Meta inválida' using errcode = '23503';
    end if;
    return new;
  end if;

  if TG_TABLE_NAME = 'presupuestos' then
    if new.category_id is not null
       and not exists (select 1 from categorias where id = new.category_id and user_id = new.user_id) then
      raise exception 'Categoría inválida' using errcode = '23503';
    end if;
    return new;
  end if;

  -- ingresos, gastos, categorias: bolsillo propio (o el predeterminado si no viene)
  if new.bolsillo_id is null then
    select id into new.bolsillo_id from bolsillos where user_id = new.user_id and is_default;
  end if;
  select * into v_bolsillo from bolsillos where id = new.bolsillo_id and user_id = new.user_id;
  if not found then
    raise exception 'Bolsillo inválido' using errcode = '23503';
  end if;
  if TG_OP = 'INSERT' and v_bolsillo.archived_at is not null then
    raise exception 'Ese bolsillo está archivado: desarchivalo para registrar movimientos' using errcode = '22023';
  end if;

  if TG_TABLE_NAME = 'categorias' then
    return new;
  end if;

  -- ingresos, gastos: la categoría debe ser del mismo bolsillo
  if new.category_id is not null then
    if not exists (
      select 1 from categorias
      where id = new.category_id and user_id = new.user_id and bolsillo_id = new.bolsillo_id
    ) then
      raise exception 'Categoría inválida' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

drop trigger gastos_assert_owned_refs on public.gastos;
drop trigger ingresos_assert_owned_refs on public.ingresos;
create trigger gastos_assert_owned_refs before insert or update of category_id, user_id, bolsillo_id on public.gastos
  for each row execute function public.assert_owned_refs();
create trigger ingresos_assert_owned_refs before insert or update of category_id, user_id, bolsillo_id on public.ingresos
  for each row execute function public.assert_owned_refs();
create trigger categorias_assert_owned_refs before insert or update of user_id, bolsillo_id on public.categorias
  for each row execute function public.assert_owned_refs();

-- ---------------------------------------------------------------------------
-- 5. Alta de usuario: crea su bolsillo personal y siembra sus categorías
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bolsillo uuid;
begin
  insert into public.usuarios (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.configuracion (user_id) values (new.id);

  insert into public.bolsillos (user_id, name, kind, color, icon, is_default)
  values (new.id, 'Ingresos personales', 'personal', '#3b7bf6', '👤', true)
  returning id into v_bolsillo;

  perform public.sembrar_categorias(new.id, v_bolsillo, 'personal');

  return new;
end;
$$;
