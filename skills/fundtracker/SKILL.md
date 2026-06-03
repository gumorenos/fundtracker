---
name: fundtracker
description: "Registra gastos y consulta el estado del fondo de emergencias via API REST."
version: 4.0.0
author: Gustavo
license: MIT
platforms: [linux, macos, windows]
prerequisites:
  env_vars: [FUNDTRACKER_API_URL]
  commands: [curl, jq]
metadata:
  hermes:
    tags: [finanzas, gastos, fondo, emergencia, presupuesto]
---
# FundTracker — Seguimiento de Fondo de Emergencias

Skill para registrar gastos y consultar el estado del fondo de emergencias del usuario.
Responde siempre en español. Sé conciso y amigable.

## Configuración

```bash
FUNDTRACKER_API_URL=http://backend:8000  # URL interna del backend
```

## Cuándo usar este skill

Usar este skill cuando el usuario:
- Reporte un gasto ("gasté X", "pagué X", "compré X")
- Haga un cambio de moneda ("cambié X dólares", "cambié X USD")
- Consulte su saldo ("cuánto tengo", "cuánto me queda")
- Consulte sus gastos ("cuánto gasté", "cómo van mis gastos")
- Pregunte proyecciones ("cuánto me dura", "hasta cuándo me alcanza")
- Escriba "/mi-id" o pida su chat ID

---

## PASO 0 — Identificación de usuario (OBLIGATORIO antes de cualquier acción)

Al recibir CUALQUIER mensaje, lo primero es identificar quién escribe y obtener su token personal.

### 1. Determinar plataforma y chat_id

- Si el mensaje viene de Telegram: `platform = "telegram"`, obtener el `chat_id` del mensaje entrante.
- Si el mensaje viene de WhatsApp: `platform = "whatsapp"`, obtener el número de teléfono del remitente.

### 2. Obtener token del usuario

```bash
USER_TOKEN=$(curl -s -X POST "${FUNDTRACKER_API_URL}/auth/platform-token" \
  -H "Content-Type: application/json" \
  -d "{\"platform\": \"telegram\", \"platform_chat_id\": \"<CHAT_ID>\"}" \
  | jq -r '.token')
```

Reemplazar `telegram` y `<CHAT_ID>` según la plataforma y el remitente real.

### 3. Si la respuesta es 404

Responder al usuario:
> "No tienes una cuenta vinculada en FundTracker.
> Ve a la app y en **Settings → Mensajería** vincula tu cuenta de Telegram.
> Necesitarás tu Chat ID: es `<CHAT_ID>`."

**No intentar registrar nada. Detener aquí.**

### 4. Si la respuesta contiene token

Usar `USER_TOKEN` para TODOS los requests siguientes. **No usar ningún token global.**

---

## Comando /mi-id

Si el usuario escribe "/mi-id", "cuál es mi id", "dame mi chat id" o similar:

Responder:
> "Tu Chat ID de Telegram es: `<CHAT_ID_DEL_MENSAJE>`
> Cópialo y pégalo en FundTracker → Settings → Mensajería para vincular tu cuenta."

No llamar a ningún endpoint. Solo reportar el chat_id del mensaje entrante.

---

## Autenticación

Incluir en todos los requests (usar `USER_TOKEN` obtenido en el Paso 0):

```bash
-H "Authorization: Bearer ${USER_TOKEN}"
-H "Content-Type: application/json"
```

## Estructura de fondos

Cada usuario tiene fondos independientes. Cada fondo tiene:
- `balance_usd`: saldo en dólares
- `balance_pen`: saldo en soles (del mismo fondo)
- `currency_mode`: 'usd_only' | 'pen_only' | 'both'

Consultar fondos disponibles antes de registrar un cambio o gasto en USD:

```bash
curl -s "${FUNDTRACKER_API_URL}/funds" \
  -H "Authorization: Bearer ${USER_TOKEN}" | \
  jq '.[] | {id, name, balance_usd, balance_pen}'
```

## 1. Registrar gasto normal en soles

Cuando el usuario dice: "gasté 45 soles en taxi", "pagué 80 en comida", etc.

fund_id es OPCIONAL. Si el usuario no especifica fondo, omitirlo (gasto "sin asignar").

```bash
curl -s -X POST "${FUNDTRACKER_API_URL}/transactions" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "amount_pen": 45.00,
    "category_id": 1,
    "fund_id": 1,
    "description": "Taxi",
    "transaction_date": "2024-01-15"
  }' | jq '{mensaje: "Gasto registrado", monto: .amount_pen, fondo: .fund_id}'
```

### Categorías disponibles
Consultar categorías actuales:

```bash
curl -s "${FUNDTRACKER_API_URL}/categories" \
  -H "Authorization: Bearer ${USER_TOKEN}" | jq '.[] | {id, name}'
```

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

Si no está seguro de la categoría, preguntar antes de registrar.

## 2. Registrar cambio de moneda

Cuando el usuario dice: "cambié 100 dólares", "cambié 50 USD del fondo personal", etc.
El cambio descuenta USD del fondo y SUMA PEN al mismo fondo.

```bash
curl -s -X POST "${FUNDTRACKER_API_URL}/transactions" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
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
```

Si el usuario no especifica fondo, preguntar: "¿De qué fondo sacaste los dólares?"
Si no menciona tipo de cambio, preguntar: "¿A qué tipo de cambio lo cambiaste?"
Si no menciona monto en soles, calcular: amount_pen = amount_usd * exchange_rate

## 3. Registrar gasto directo en USD

Cuando el usuario dice: "pagué 20 dólares", "gasté USD 50", etc.

```bash
curl -s -X POST "${FUNDTRACKER_API_URL}/transactions" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "usd_expense",
    "amount_usd": 20.00,
    "fund_id": 1,
    "category_id": 6,
    "description": "Descripción",
    "transaction_date": "2024-01-15"
  }' | jq '{mensaje: "Gasto USD registrado", monto: .amount_usd}'
```

## 4. Consultar resumen y saldo

Cuando el usuario pregunta cuánto tiene o cómo van sus gastos:

```bash
curl -s "${FUNDTRACKER_API_URL}/summary" \
  -H "Authorization: Bearer ${USER_TOKEN}" | jq '.'
```

Presentar la respuesta así (iterar sobre `.funds[]`):
💰 Fondos:
• [name]: $[balance_usd] USD · S/ [balance_pen] — se agota ~[projected_exhaustion_date] ([projected_days_remaining]d)
  (si `projected_days_remaining` es null: "sin proyección")
• Sin asignar: S/ [total gastos expense sin fund_id] (si aplica)
📊 Total USD: $[total_usd]  |  Total PEN: S/ [total_pen]
📊 Este mes: S/ [gasto_mes_actual_pen] gastados en soles
📈 Proyección global: hasta [proyeccion_agotamiento] ([proyeccion_dias_restantes] días)
   (si null: "sin datos suficientes")

## 5. Consultar gastos por categoría o período

```bash
# Gastos del mes actual
curl -s "${FUNDTRACKER_API_URL}/transactions?date_from=2024-01-01&date_to=2024-01-31&limit=50" \
  -H "Authorization: Bearer ${USER_TOKEN}" | \
  jq '[.[] | {fecha: .transaction_date, desc: .description, pen: .amount_pen}]'

# Gastos de una categoría específica
curl -s "${FUNDTRACKER_API_URL}/transactions?category_id=1&limit=20" \
  -H "Authorization: Bearer ${USER_TOKEN}" | \
  jq '[.[] | {fecha: .transaction_date, desc: .description, pen: .amount_pen}]'
```

## Manejo de errores

Si la API devuelve error 401: el token expiró o es inválido. Repetir el Paso 0 para obtener uno nuevo.
Si la API devuelve error 404 en platform-token: cuenta no vinculada (ver Paso 0, punto 3).
Si la API devuelve error 429: rate limit alcanzado. Esperar un minuto antes de reintentar.
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
