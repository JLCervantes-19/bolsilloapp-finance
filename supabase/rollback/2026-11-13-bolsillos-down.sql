-- ============================================================================
-- REVERSIÓN de bolsillos múltiples (bolsillos_core + bolsillos_transferencias)
--
-- Qué conserva: TODOS los ingresos, gastos y categorías (solo se les quita la
-- etiqueta de bolsillo: vuelven a ser del usuario, como antes).
-- Qué se pierde: la tabla bolsillos (nombres, colores, saldos iniciales) y las
-- transferencias (inversiones, retiros, traslados) registradas después de la
-- migración. Exportarlas antes si se quieren conservar:
--   copy (select * from public.transferencias) to stdout with csv header;
-- Ejecutar en una sola transacción desde el SQL Editor.
-- ============================================================================
begin;

drop function if exists public.eliminar_bolsillo(uuid, uuid, boolean);
drop function if exists public.bolsillos_resumen(date, date);
drop view if exists public.movimientos;
drop table if exists public.transferencias;
drop function if exists public.assert_transfer_refs();

drop trigger if exists categorias_assert_owned_refs on public.categorias;
drop trigger if exists gastos_assert_owned_refs on public.gastos;
drop trigger if exists ingresos_assert_owned_refs on public.ingresos;

create or replace function public.assert_owned_refs()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if TG_TABLE_NAME = 'ahorros' then
    if new.goal_id is not null
       and not exists (select 1 from metas where id = new.goal_id and user_id = new.user_id) then
      raise exception 'Meta inválida' using errcode = '23503';
    end if;
  elsif new.category_id is not null
        and not exists (select 1 from categorias where id = new.category_id and user_id = new.user_id) then
    raise exception 'Categoría inválida' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger gastos_assert_owned_refs before insert or update of category_id, user_id on public.gastos
  for each row execute function public.assert_owned_refs();
create trigger ingresos_assert_owned_refs before insert or update of category_id, user_id on public.ingresos
  for each row execute function public.assert_owned_refs();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url');
  insert into public.configuracion (user_id) values (new.id);
  insert into public.categorias (user_id, name, color, kind, is_default) values
    (new.id, 'Vivienda',       '#2B2D42', 'expense', true),
    (new.id, 'Servicios',      '#E76F51', 'expense', true),
    (new.id, 'Alimentación',   '#F4A261', 'expense', true),
    (new.id, 'Suscripciones',  '#E07A5F', 'expense', true),
    (new.id, 'Transporte',     '#81B29A', 'expense', true),
    (new.id, 'Antojos',        '#787774', 'expense', true),
    (new.id, 'Salario',        '#2A9D8F', 'income',  true),
    (new.id, 'Ingreso extra',  '#81B29A', 'income',  true),
    (new.id, 'Rendimientos',   '#F4A261', 'income',  true);
  return new;
end;
$$;

drop index if exists public.categorias_bolsillo_idx;
drop index if exists public.ingresos_user_bolsillo_fecha_idx;
drop index if exists public.gastos_user_bolsillo_fecha_idx;
alter table public.ingresos   drop column if exists bolsillo_id, drop column if exists payment_method;
alter table public.gastos     drop column if exists bolsillo_id;
alter table public.categorias drop column if exists bolsillo_id;

drop table if exists public.bolsillos;
drop function if exists public.sembrar_categorias_bolsillo_nuevo();
drop function if exists public.sembrar_categorias(uuid, uuid, text);
drop function if exists public.proteger_bolsillo_predeterminado();

commit;
