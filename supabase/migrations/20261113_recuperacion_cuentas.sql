-- Cuentas sin correo (2026-11-13): el usuario entra con nombre de usuario y
-- recupera la cuenta con un código que se le muestra una sola vez. Aquí se
-- guarda solo el hash (scrypt) del código. RLS activo sin políticas: solo el
-- backend (service role) puede leer o escribir esta tabla.
create table public.recuperacion_cuentas (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  code_hash  text not null,
  updated_at timestamptz not null default now()
);
comment on table public.recuperacion_cuentas is 'Usuario y hash del código de recuperación (sin correo). Solo accesible con service role: RLS activo sin políticas.';
alter table public.recuperacion_cuentas enable row level security;
revoke all on public.recuperacion_cuentas from anon, authenticated;
