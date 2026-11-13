-- ============================================================================
-- Bolsillos múltiples — transferencias, historial unificado y saldos
-- (migración bolsillos_transferencias)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. transferencias: inversión (aporte), retiro y traslado entre bolsillos.
--    Un único registro con ambos extremos. Nunca es ingreso ni gasto: por eso
--    no puede duplicarse en los totales consolidados.
-- ---------------------------------------------------------------------------
create table public.transferencias (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('aporte', 'retiro', 'traslado')),
  from_bolsillo_id  uuid references public.bolsillos(id),
  to_bolsillo_id    uuid references public.bolsillos(id),
  amount            numeric(14,2) not null check (amount > 0),
  date              date not null default ((now() at time zone 'America/Bogota')::date),
  description       text check (description is null or char_length(description) <= 280),
  payment_method    text check (payment_method is null or char_length(payment_method) <= 60),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint transferencias_extremos check (
    (kind = 'aporte'   and to_bolsillo_id is not null) or
    (kind = 'retiro'   and from_bolsillo_id is not null) or
    (kind = 'traslado' and from_bolsillo_id is not null and to_bolsillo_id is not null)
  ),
  constraint transferencias_extremos_distintos check (from_bolsillo_id is distinct from to_bolsillo_id)
);

comment on table public.transferencias is 'Movimientos entre cajas: aporte (inversión de capital a un negocio; origen null = dinero externo), retiro (sale de un negocio; destino null = el dueño se lo lleva) y traslado (entre dos bolsillos). No son ingresos ni gastos.';

create index transferencias_user_fecha_idx on public.transferencias (user_id, date);
create index transferencias_from_idx on public.transferencias (from_bolsillo_id, date) where from_bolsillo_id is not null;
create index transferencias_to_idx on public.transferencias (to_bolsillo_id, date) where to_bolsillo_id is not null;

alter table public.transferencias enable row level security;
create policy transferencias_select_own on public.transferencias for select using (user_id = (select auth.uid()));
create policy transferencias_insert_own on public.transferencias for insert with check (user_id = (select auth.uid()));
create policy transferencias_update_own on public.transferencias for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy transferencias_delete_own on public.transferencias for delete using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.transferencias to authenticated;

create trigger set_updated_at before update on public.transferencias
  for each row execute function public.handle_updated_at();
create trigger audit_transferencias after insert or update or delete on public.transferencias
  for each row execute function public.log_audit();

create or replace function public.assert_transfer_refs()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_from public.bolsillos;
  v_to   public.bolsillos;
begin
  if new.from_bolsillo_id is not null then
    select * into v_from from bolsillos where id = new.from_bolsillo_id and user_id = new.user_id;
    if not found then
      raise exception 'Bolsillo de origen inválido' using errcode = '23503';
    end if;
  end if;
  if new.to_bolsillo_id is not null then
    select * into v_to from bolsillos where id = new.to_bolsillo_id and user_id = new.user_id;
    if not found then
      raise exception 'Bolsillo de destino inválido' using errcode = '23503';
    end if;
  end if;

  if new.kind = 'aporte' then
    if v_to.kind is distinct from 'business' then
      raise exception 'La inversión solo puede entrar a un bolsillo de negocio' using errcode = '22023';
    end if;
    if new.from_bolsillo_id is not null and v_from.kind <> 'personal' then
      raise exception 'La inversión sale de un bolsillo personal; entre negocios usá un traslado' using errcode = '22023';
    end if;
  elsif new.kind = 'retiro' then
    if v_from.kind is distinct from 'business' then
      raise exception 'Los retiros solo salen de un bolsillo de negocio' using errcode = '22023';
    end if;
    if new.to_bolsillo_id is not null and v_to.kind <> 'personal' then
      raise exception 'El retiro va a un bolsillo personal; entre negocios usá un traslado' using errcode = '22023';
    end if;
  end if;

  if TG_OP = 'INSERT' and (v_from.archived_at is not null or v_to.archived_at is not null) then
    raise exception 'Uno de los bolsillos está archivado: desarchivalo para registrar movimientos' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger transferencias_assert_refs before insert or update of kind, from_bolsillo_id, to_bolsillo_id, user_id on public.transferencias
  for each row execute function public.assert_transfer_refs();

-- ---------------------------------------------------------------------------
-- 2. Historial unificado. Cada transferencia aparece una vez por extremo;
--    `principal` marca un único lado para el historial consolidado.
-- ---------------------------------------------------------------------------
create view public.movimientos with (security_invoker = true) as
  select i.id, i.user_id, i.bolsillo_id, 'ingreso'::text as tipo, 'entrada'::text as direccion,
         i.amount as monto, i.date as fecha, i.category_id, c.name as categoria_nombre, c.color as categoria_color,
         i.payment_method as metodo_pago, i.description as descripcion, null::uuid as contraparte_bolsillo_id,
         'ingresos'::text as origen, true as principal, i.created_at
  from public.ingresos i left join public.categorias c on c.id = i.category_id
  union all
  select g.id, g.user_id, g.bolsillo_id, 'gasto', 'salida',
         g.amount, g.date, g.category_id, c.name, c.color,
         g.payment_method, g.description, null::uuid,
         'gastos', true, g.created_at
  from public.gastos g left join public.categorias c on c.id = g.category_id
  union all
  select t.id, t.user_id, t.from_bolsillo_id, t.kind, 'salida',
         t.amount, t.date, null::uuid, null, null,
         t.payment_method, t.description, t.to_bolsillo_id,
         'transferencias', true, t.created_at
  from public.transferencias t where t.from_bolsillo_id is not null
  union all
  select t.id, t.user_id, t.to_bolsillo_id, t.kind, 'entrada',
         t.amount, t.date, null::uuid, null, null,
         t.payment_method, t.description, t.from_bolsillo_id,
         'transferencias', (t.from_bolsillo_id is null), t.created_at
  from public.transferencias t where t.to_bolsillo_id is not null;

comment on view public.movimientos is 'Historial unificado (ingresos, gastos, transferencias por extremo). security_invoker: aplica la RLS de cada tabla.';
revoke all on public.movimientos from anon;
grant select on public.movimientos to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Cálculo central de saldos y totales por bolsillo (único lugar)
--    saldo = inicial + ingresos − gastos + entradas − salidas
--            − (solo el predeterminado) ahorrado en metas + invertido en portafolio
-- ---------------------------------------------------------------------------
create or replace function public.bolsillos_resumen(p_desde date default null, p_hasta date default null)
returns table (
  bolsillo_id       uuid,
  saldo             numeric,
  ingresos_total    numeric,
  gastos_total      numeric,
  entradas_total    numeric,
  salidas_total     numeric,
  aportes_total     numeric,
  retiros_total     numeric,
  apartado          numeric,
  ingresos_periodo  numeric,
  gastos_periodo    numeric,
  entradas_periodo  numeric,
  salidas_periodo   numeric,
  aportes_periodo   numeric,
  retiros_periodo   numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with b as (
    select * from bolsillos where user_id = (select auth.uid())
  ),
  ing as (
    select i.bolsillo_id as bid, sum(i.amount) as total,
           sum(i.amount) filter (where i.date between p_desde and p_hasta) as periodo
    from ingresos i where i.user_id = (select auth.uid()) group by 1
  ),
  gas as (
    select g.bolsillo_id as bid, sum(g.amount) as total,
           sum(g.amount) filter (where g.date between p_desde and p_hasta) as periodo
    from gastos g where g.user_id = (select auth.uid()) group by 1
  ),
  ent as (
    select t.to_bolsillo_id as bid, sum(t.amount) as total,
           sum(t.amount) filter (where t.date between p_desde and p_hasta) as periodo,
           sum(t.amount) filter (where t.kind = 'aporte') as aportes,
           sum(t.amount) filter (where t.kind = 'aporte' and t.date between p_desde and p_hasta) as aportes_periodo
    from transferencias t where t.user_id = (select auth.uid()) and t.to_bolsillo_id is not null group by 1
  ),
  sal as (
    select t.from_bolsillo_id as bid, sum(t.amount) as total,
           sum(t.amount) filter (where t.date between p_desde and p_hasta) as periodo,
           sum(t.amount) filter (where t.kind = 'retiro') as retiros,
           sum(t.amount) filter (where t.kind = 'retiro' and t.date between p_desde and p_hasta) as retiros_periodo
    from transferencias t where t.user_id = (select auth.uid()) and t.from_bolsillo_id is not null group by 1
  ),
  apart as (
    select coalesce((select sum(current_amount) from metas where user_id = (select auth.uid())), 0)
         + coalesce((select sum(amount_invested) from inversiones where user_id = (select auth.uid())), 0) as v
  )
  select
    b.id,
    b.initial_balance + coalesce(ing.total, 0) - coalesce(gas.total, 0)
      + coalesce(ent.total, 0) - coalesce(sal.total, 0)
      - case when b.is_default then apart.v else 0 end,
    coalesce(ing.total, 0), coalesce(gas.total, 0),
    coalesce(ent.total, 0), coalesce(sal.total, 0),
    coalesce(ent.aportes, 0), coalesce(sal.retiros, 0),
    case when b.is_default then apart.v else 0 end,
    coalesce(ing.periodo, 0), coalesce(gas.periodo, 0),
    coalesce(ent.periodo, 0), coalesce(sal.periodo, 0),
    coalesce(ent.aportes_periodo, 0), coalesce(sal.retiros_periodo, 0)
  from b
  cross join apart
  left join ing on ing.bid = b.id
  left join gas on gas.bid = b.id
  left join ent on ent.bid = b.id
  left join sal on sal.bid = b.id;
$$;
revoke execute on function public.bolsillos_resumen(date, date) from public, anon;
grant execute on function public.bolsillos_resumen(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Eliminar un bolsillo sin perder datos en silencio:
--    - sin movimientos: se borra;
--    - con movimientos: hay que elegir destino (mismo tipo) o pedir borrado
--      explícito. Al mover: categorías (fusionando las de igual nombre),
--      ingresos, gastos, transferencias y saldo inicial pasan al destino; las
--      transferencias entre ambos se anulan (se compensaban dentro del destino).
-- ---------------------------------------------------------------------------
create or replace function public.eliminar_bolsillo(p_id uuid, p_destino uuid default null, p_borrar_movimientos boolean default false)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_b       public.bolsillos;
  v_d       public.bolsillos;
  v_ing     integer := 0;
  v_gas     integer := 0;
  v_tra     integer := 0;
  v_tiene   boolean;
begin
  select * into v_b from bolsillos where id = p_id;
  if not found then
    raise exception 'Bolsillo no encontrado' using errcode = 'P0002';
  end if;
  if v_b.is_default then
    raise exception 'El bolsillo personal predeterminado no se puede eliminar' using errcode = '22023';
  end if;

  v_tiene := exists (select 1 from ingresos where bolsillo_id = p_id)
          or exists (select 1 from gastos where bolsillo_id = p_id)
          or exists (select 1 from transferencias where from_bolsillo_id = p_id or to_bolsillo_id = p_id);

  if v_tiene and p_destino is null and not p_borrar_movimientos then
    raise exception 'Este bolsillo tiene movimientos: elegí a qué bolsillo moverlos o confirmá que se borren' using errcode = '22023';
  end if;

  if p_destino is not null then
    if p_destino = p_id then
      raise exception 'Elegí un bolsillo distinto como destino' using errcode = '22023';
    end if;
    select * into v_d from bolsillos where id = p_destino;
    if not found then
      raise exception 'Bolsillo de destino inválido' using errcode = '23503';
    end if;
    if v_d.kind <> v_b.kind then
      raise exception 'Los movimientos solo se pueden mover a otro bolsillo del mismo tipo' using errcode = '22023';
    end if;
    if v_d.archived_at is not null then
      raise exception 'El bolsillo de destino está archivado' using errcode = '22023';
    end if;

    -- Categorías sin homónimo en el destino se mudan tal cual.
    update categorias s set bolsillo_id = p_destino, is_default = false
    where s.bolsillo_id = p_id
      and not exists (
        select 1 from categorias d
        where d.bolsillo_id = p_destino and d.deleted_at is null
          and d.kind = s.kind and lower(d.name) = lower(s.name)
      );

    -- Movimientos: los que usaban una categoría con homónimo pasan a la del destino.
    update ingresos i set bolsillo_id = p_destino,
      category_id = coalesce((
        select d.id from categorias s
        join categorias d on d.bolsillo_id = p_destino and d.deleted_at is null and d.kind = s.kind and lower(d.name) = lower(s.name)
        where s.id = i.category_id and s.bolsillo_id = p_id
        limit 1), i.category_id)
    where i.bolsillo_id = p_id;
    get diagnostics v_ing = row_count;

    update gastos g set bolsillo_id = p_destino,
      category_id = coalesce((
        select d.id from categorias s
        join categorias d on d.bolsillo_id = p_destino and d.deleted_at is null and d.kind = s.kind and lower(d.name) = lower(s.name)
        where s.id = g.category_id and s.bolsillo_id = p_id
        limit 1), g.category_id)
    where g.bolsillo_id = p_id;
    get diagnostics v_gas = row_count;

    delete from transferencias
    where (from_bolsillo_id = p_id and to_bolsillo_id = p_destino)
       or (from_bolsillo_id = p_destino and to_bolsillo_id = p_id);
    update transferencias set from_bolsillo_id = p_destino where from_bolsillo_id = p_id;
    get diagnostics v_tra = row_count;
    update transferencias set to_bolsillo_id = p_destino where to_bolsillo_id = p_id;

    update bolsillos set initial_balance = initial_balance + v_b.initial_balance where id = p_destino;
  elsif p_borrar_movimientos then
    delete from transferencias where from_bolsillo_id = p_id or to_bolsillo_id = p_id;
    delete from ingresos where bolsillo_id = p_id;
    delete from gastos where bolsillo_id = p_id;
  end if;

  delete from bolsillos where id = p_id;

  return json_build_object('ingresos_movidos', v_ing, 'gastos_movidos', v_gas, 'transferencias_movidas', v_tra);
end;
$$;
revoke execute on function public.eliminar_bolsillo(uuid, uuid, boolean) from public, anon;
grant execute on function public.eliminar_bolsillo(uuid, uuid, boolean) to authenticated;
