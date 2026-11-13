#!/usr/bin/env bash
# Prueba de humo contra un entorno real. Crea un usuario temporal, ejercita
# los flujos de dinero y lo elimina al final con DELETE /api/auth/account.
# Uso: scripts/smoke-test.sh http://localhost:3001   |   scripts/smoke-test.sh https://onemillionapp.vercel.app
set -euo pipefail
BASE="${1:?Uso: smoke-test.sh <url-base>}"
API="$BASE/api"
H='content-type: application/json'
USR="smoke-$(date +%s)"
PASS="Smoke$(date +%s)!"

fail() { echo "FALLÓ: $1"; exit 1; }
expect() { [ "$2" = "$3" ] || fail "$1 → esperado $3, recibido $2"; echo "ok  $1"; }
json() { python3 -c "import json,sys;d=json.load(sys.stdin);print($1)"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

# Los cuerpos JSON van en variables: el bash 3.2 de macOS parte mal las
# comillas escapadas anidadas dentro de "$(...)".
SIGNUP="{\"username\":\"$USR\",\"password\":\"$PASS\",\"full_name\":\"Smoke\",\"accepted_privacy\":true}"
OUT=$(curl -s -X POST "$API/auth/signup" -H "$H" -d "$SIGNUP")
TOK=$(echo "$OUT" | json "d['data']['session']['access_token']")
RCODE=$(echo "$OUT" | json "d['data']['recovery_code']")
A="Authorization: Bearer $TOK"
# Siempre borra el usuario temporal, también si una verificación falla
# (exit no dispara el trap ERR). Si ya se borró, responde 401 y no pasa nada.
trap 'curl -s -o /dev/null -X DELETE "$API/auth/account" -H "$A" || true' EXIT

# Cuentas sin correo: entrar con usuario y recuperar con el código.
LOGIN="{\"username\":\"$USR\",\"password\":\"$PASS\"}"
expect "login con usuario" "$(code -X POST "$API/auth/login" -H "$H" -d "$LOGIN")" 200
PASS2="Nueva$(date +%s)!"
BAD="{\"username\":\"$USR\",\"recovery_code\":\"AAAA-BBBB-CCCC\",\"password\":\"$PASS2\"}"
expect "recuperar con código malo" "$(code -X POST "$API/auth/recover" -H "$H" -d "$BAD")" 400
RECOVER="{\"username\":\"$USR\",\"recovery_code\":\"$RCODE\",\"password\":\"$PASS2\"}"
OUT=$(curl -s -X POST "$API/auth/recover" -H "$H" -d "$RECOVER")
TOK=$(echo "$OUT" | json "d['data']['session']['access_token']")
RCODE2=$(echo "$OUT" | json "d['data']['recovery_code']")
A="Authorization: Bearer $TOK"
[ "$RCODE2" != "$RCODE" ] || fail "el código no se renovó"
echo "ok  recuperar con código"
expect "código usado ya no sirve" "$(code -X POST "$API/auth/recover" -H "$H" -d "$RECOVER")" 400
expect "login con contraseña vieja" "$(code -X POST "$API/auth/login" -H "$H" -d "$LOGIN")" 401
LOGIN2="{\"username\":\"$USR\",\"password\":\"$PASS2\"}"
expect "login con contraseña nueva" "$(code -X POST "$API/auth/login" -H "$H" -d "$LOGIN2")" 200
expect "código nuevo con contraseña mala" "$(code -X POST "$API/auth/recovery-code" -H "$A" -H "$H" -d '{"password":"mala"}')" 400
expect "código nuevo" "$(code -X POST "$API/auth/recovery-code" -H "$A" -H "$H" -d "{\"password\":\"$PASS2\"}")" 200
# Sin token, una ruta inexistente responde 401 (la API exige sesión antes del 404).
expect "forgot-password eliminado" "$(code -X POST "$API/auth/forgot-password" -H "$A" -H "$H" -d '{}')" 404

for p in /dashboard/summary /analytics/monthly /categories /settings /debts/strategy /goals /alerts /pockets /pockets/consolidated /movements; do
  expect "GET $p" "$(code "$API$p" -H "$A")" 200
done

ECAT=$(curl -s "$API/categories" -H "$A" | json "[c['id'] for c in d['data'] if c['kind']=='expense'][0]")
ICAT=$(curl -s "$API/categories" -H "$A" | json "[c['id'] for c in d['data'] if c['kind']=='income'][0]")

EXPENSE="{\"category_id\":\"$ECAT\",\"amount\":1000}"
INCOME="{\"category_id\":\"$ICAT\",\"amount\":100000,\"allocate_emergency_fund_pct\":10,\"allocate_investment_pct\":5}"

expect "gasto rápido" "$(code -X POST "$API/transactions/quick-expense" -H "$A" -H "$H" -d "$EXPENSE")" 201
GOAL=$(curl -s -X POST "$API/goals" -H "$A" -H "$H" -d '{"name":"Fondo","target_amount":100000,"is_emergency_fund":true}' | json "d['data']['id']")
expect "segundo fondo de emergencia" "$(code -X POST "$API/goals" -H "$A" -H "$H" -d '{"name":"Otro","target_amount":1,"is_emergency_fund":true}')" 409
expect "abono a meta" "$(code -X POST "$API/goals/$GOAL/contribute" -H "$A" -H "$H" -d '{"amount":5000}')" 201
expect "ingreso con asignaciones" "$(code -X POST "$API/transactions/quick-income" -H "$A" -H "$H" -d "$INCOME")" 201

# 100000 ingreso − 1000 gasto − (5000 + 10000) en meta − 5000 invertido = 79000
expect "saldo disponible" "$(curl -s "$API/dashboard/summary" -H "$A" | json "int(d['data']['balance'])")" 79000

# Bolsillos: un negocio con su venta y un retiro al personal. El retiro mueve
# saldos pero no es ingreso ni gasto en el consolidado.
POCKET=$(curl -s "$API/pockets" -H "$A" | json "d['data'][0]['id']")
NEG=$(curl -s -X POST "$API/pockets" -H "$A" -H "$H" -d '{"name":"Smoke negocio","kind":"business","initial_balance":1000}' | json "d['data']['id']")
VCAT=$(curl -s "$API/categories?bolsillo=$NEG" -H "$A" | json "[c['id'] for c in d['data'] if c['kind']=='income'][0]")
VENTA="{\"bolsillo_id\":\"$NEG\",\"category_id\":\"$VCAT\",\"amount\":5000}"
RETIRO="{\"kind\":\"retiro\",\"from_bolsillo_id\":\"$NEG\",\"to_bolsillo_id\":\"$POCKET\",\"amount\":2000}"
MISMO="{\"kind\":\"traslado\",\"from_bolsillo_id\":\"$NEG\",\"to_bolsillo_id\":\"$NEG\",\"amount\":1}"
expect "venta en negocio" "$(code -X POST "$API/transactions/quick-income" -H "$A" -H "$H" -d "$VENTA")" 201
expect "retiro enlazado" "$(code -X POST "$API/transfers" -H "$A" -H "$H" -d "$RETIRO")" 201
expect "traslado a sí mismo" "$(code -X POST "$API/transfers" -H "$A" -H "$H" -d "$MISMO")" 400
# 100000 + 5000 de ingresos globales; el retiro de 2000 no suma
expect "ingresos consolidados" "$(curl -s "$API/pockets/consolidated" -H "$A" | json "int(d['data']['ingresosPeriodo'])")" 105000
# negocio: 1000 inicial + 5000 venta − 2000 retiro
expect "saldo del negocio" "$(curl -s "$API/pockets" -H "$A" | json "int([p for p in d['data'] if p['id']=='$NEG'][0]['metrics']['saldo'])")" 4000

expect "categoría ajena" "$(code -X POST "$API/expenses" -H "$A" -H "$H" -d '{"category_id":"00000000-0000-4000-8000-000000000000","amount":10}')" 400
expect "id inválido" "$(code "$API/goals/no-es-uuid" -H "$A")" 400
expect "rango inválido" "$(code "$API/expenses?start=x&end=y" -H "$A")" 400
expect "JSON mal formado" "$(code -X POST "$API/expenses" -H "$A" -H "$H" -d '{roto')" 400

expect "eliminar cuenta" "$(code -X DELETE "$API/auth/account" -H "$A")" 204
expect "token tras eliminar" "$(code "$API/dashboard/summary" -H "$A")" 401
echo "TODO OK"
