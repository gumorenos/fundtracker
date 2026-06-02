#!/bin/bash
set -e

SKILL_DIR="$HOME/hermes-stack/data/skills/productivity/fundtracker"
sudo mkdir -p "$SKILL_DIR"

sudo tee "$SKILL_DIR/SKILL.md" > /dev/null << 'SKILLEOF'
---
name: fundtracker
description: "Registra gastos y consulta el estado del fondo de emergencias via API REST."
version: 1.0.0
author: Gustavo
license: MIT
platforms: [linux, macos, windows]
prerequisites:
  env_vars: [FUNDTRACKER_API_URL, FUNDTRACKER_TOKEN]
  commands: [curl, jq]
metadata:
  hermes:
    tags: [finanzas, gastos, fondo, emergencia, presupuesto]
---
# FundTracker — Seguimiento de Fondo de Emergencias

Skill para registrar gastos y consultar el estado del fondo de emergencias del usuario.
Responde siempre en español. Sé conciso y amigable.

## Configuración
FUNDTRACKER_API_URL=http://backend:8000
FUNDTRACKER_TOKEN=<JWT del usuario>

## Cuándo usar este skill

Usar este skill cuando el usuario:
- Reporte un gasto ("gasté X", "pagué X", "compré X")
- Haga un cambio de moneda ("cambié X dólares", "cambié X USD")
- Consulte su saldo ("cuánto tengo", "cuánto me queda")
- Consulte sus gastos ("cuánto gasté", "cómo van mis gastos")
- Pregunte proyecciones ("cuánto me dura", "hasta cuándo me alcanza")

## Autenticación

Incluir en todos los requests:
  -H "Authorization: Bearer ${FUNDTRACKER_TOKEN}"
  -H "Content-Type: application/json"

## 1. Registrar gasto normal en soles

Cuando el usuario dice: "gasté 45 soles en taxi", "pagué 80 en comida", etc.

curl -s -X POST "${FUNDTRACKER_API_URL}/transactions" \
  -H "Authorization: Bearer ${FUNDTRACKER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "amount_pen": 45.00,
    "category_id": 1,
    "description": "Taxi",
    "transaction_date": "2024-01-15"
  }' | jq '{mensaje: "Gasto registrado", monto: .amount_pen, categoria: .category_id}'

### Categorías disponibles
Consultar categorías actuales:
curl -s "${FUNDTRACKER_API_URL}/categories" \
  -H "Authorization: Bearer ${FUNDTRACKER_TOKEN}" | jq '.[] | {id, name}'

Categorías por defecto:
- 1: Terapia
- 2: Transporte
- 3: Medicina
- 4: Comida
- 5: Servicios
- 6: Otros

Si el usuario no especifica categoría, inferir del contexto:
- taxi, uber, bus, pasaje → Transporte (2)
- terapia, psicólogo, sesión → Terapia (1)
- medicina, pastilla, farmacia → Medicina (3)
- comida, almuerzo, cena, desayuno, mercado → Comida (4)
- luz, agua, internet, teléfono → Servicios (5)
- cualquier otro → Otros (6)

Si no está seguro, preguntar al usuario antes de registrar.

## 2. Registrar cambio de moneda

Cuando el usuario dice: "cambié 100 dólares", "cambié 50 USD del fondo personal", etc.

curl -s -X POST "${FUNDTRACKER_API_URL}/transactions" \
  -H "Authorization: Bearer ${FUNDTRACKER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "currency_exchange",
    "amount_usd": 100.00,
    "amount_pen": 370.00,
    "exchange_rate": 3.70,
    "fund_id": 1,
    "description": "Cambio de moneda",
    "transaction_date": "2024-01-15"
  }' | jq '{mensaje: "Cambio registrado", usd: .amount_usd, pen: .amount_pen, tc: .exchange_rate}'

Fondos disponibles:
- fund_id 1: Fondo Emergencia
- fund_id 2: Fondo Personal

Si el usuario no especifica fondo, preguntar: "¿Lo sacaste del fondo de emergencia o del personal?"
Si no menciona tipo de cambio, preguntar: "¿A qué tipo de cambio lo cambiaste?"
Si no menciona monto en soles, calcular: amount_pen = amount_usd * exchange_rate

## 3. Registrar gasto directo en USD

Cuando el usuario dice: "pagué 20 dólares", "gasté USD 50", etc.

curl -s -X POST "${FUNDTRACKER_API_URL}/transactions" \
  -H "Authorization: Bearer ${FUNDTRACKER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "usd_expense",
    "amount_usd": 20.00,
    "fund_id": 1,
    "category_id": 6,
    "description": "Descripción",
    "transaction_date": "2024-01-15"
  }' | jq '{mensaje: "Gasto USD registrado", monto: .amount_usd}'

## 4. Consultar resumen y saldo

Cuando el usuario pregunta cuánto tiene o cómo van sus gastos:

curl -s "${FUNDTRACKER_API_URL}/summary" \
  -H "Authorization: Bearer ${FUNDTRACKER_TOKEN}" | jq '.'

Presentar la respuesta así:
💰 Fondos USD:
  • Emergencia: $X,XXX.XX
  • Personal: $X,XXX.XX
  • Total: $X,XXX.XX

💵 Saldo en soles: S/ X,XXX.XX

📊 Este mes: S/ XXX.XX gastados
📈 Proyección: el fondo dura hasta [fecha] ([N] días)

## 5. Consultar gastos por categoría o período

# Gastos del mes actual
curl -s "${FUNDTRACKER_API_URL}/transactions?date_from=2024-01-01&date_to=2024-01-31&limit=50" \
  -H "Authorization: Bearer ${FUNDTRACKER_TOKEN}" | \
  jq '[.[] | {fecha: .transaction_date, desc: .description, pen: .amount_pen}]'

# Gastos de una categoría específica
curl -s "${FUNDTRACKER_API_URL}/transactions?category_id=1&limit=20" \
  -H "Authorization: Bearer ${FUNDTRACKER_TOKEN}" | \
  jq '[.[] | {fecha: .transaction_date, desc: .description, pen: .amount_pen}]'

## Manejo de errores

Si la API devuelve error 401: el token expiró, informar al usuario que necesita renovar acceso.
Si la API devuelve error 422: datos inválidos, revisar los campos enviados.
Si la API no responde: informar que el servicio no está disponible momentáneamente.

## Confirmación siempre

Antes de registrar cualquier transacción, confirmar con el usuario:
"¿Registro esto? [descripción del gasto con monto y categoría inferida]"
A menos que el usuario haya dicho explícitamente "registra" o "anota".

## Fecha

Si el usuario no especifica fecha, usar la fecha actual.
Si dice "ayer", usar la fecha de ayer.
Si dice "el lunes", calcular la fecha correspondiente.
SKILLEOF

echo "✅ Skill instalado en $SKILL_DIR"
echo ""
echo "Próximos pasos:"
echo "1. Conectar hermes-agent a fundtracker_net:"
echo "   docker network connect fundtracker_fundtracker_net hermes-agent"
echo "2. Agregar variables al .env.hermes.secrets:"
echo "   FUNDTRACKER_API_URL=http://backend:8000"
echo "   FUNDTRACKER_TOKEN=<JWT_del_viewer>"
echo "3. Reiniciar hermes-agent:"
echo "   docker restart hermes-agent"
