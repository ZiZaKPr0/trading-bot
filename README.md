# Bot Trading — Polymarket

Monorepo TypeScript con **4 bots independientes**, heartbeat compartido y dashboard web. Implementa las **5 fases** del plan.

## Estrategias

| Bot | Fase | Descripción |
|-----|------|-------------|
| **Cesta Top-K** | 2 | Arbitraje NegRisk top-K, WS + poll, FOK thin-leg-first |
| **Liquidity Maker** | 3 | LAS en logit space + Liquidity Rewards + kill switch |
| **Endgame Carry** | 4 | Tails 95–99¢, filtros UMA + LLM opcional |
| **Espejo Smart** | 5 | Copy instantáneo (delay 0), wallet scorer + slippage 1¢ |

## Setup rápido

```bash
cp .env.example .env
npm install
npm run setup      # geofence + DB + L2 keys
npm run smoke-test # valida CLOB
npm run build
```

## Arranque

```bash
npm run dev          # local: API + UI con hot reload
npm run pm2:start    # VPS: bots + API (sirve UI en prod)
npm run pm2:logs
```

## Autenticación (obligatorio en VPS)

Añade a `.env`:

```env
DASHBOARD_AUTH_ENABLED=true
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=tu_contraseña_segura
DASHBOARD_SESSION_SECRET=genera_un_string_aleatorio_de_32_chars_minimo
DASHBOARD_COOKIE_SECURE=true          # true detrás de HTTPS
DASHBOARD_TRUSTED_ORIGINS=https://tudominio.com
```

Generar secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

En **local** puedes desactivar auth: `DASHBOARD_AUTH_ENABLED=false`

## Despliegue VPS (un solo puerto)

```bash
npm run build
NODE_ENV=production npm run start -w @bot-trading/dashboard-api
# Sirve UI + API en :3001 — pon Nginx/Caddy delante con HTTPS
```

Recomendado: Nginx reverse proxy → `localhost:3001`, certificado Let's Encrypt, `DASHBOARD_COOKIE_SECURE=true`.

## Flags por bot (`.env`)

```
BOT_CESTA_TOPK_ENABLED=true
BOT_LIQUIDITY_MAKER_ENABLED=false
BOT_ENDGAME_CARRY_ENABLED=false
BOT_ESPEJO_SMART_ENABLED=false
ESPEJO_DRY_RUN=true   # scorer sin copy hasta validar infra
PAPER_MODE=false      # true = simular órdenes
```

## Estructura

```
packages/core/           # WS, Data API, LAS prep, SQLite, risk
packages/bots/*/         # 1 proceso PM2 por estrategia
packages/dashboard/      # Fastify API + React UI
scripts/setup-bots.ts
scripts/smoke-test.ts
ecosystem.config.js
```
