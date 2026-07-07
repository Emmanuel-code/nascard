# CardVault

A production Expo/React Native mobile app for digitizing and managing physical cards (ID, health, loyalty, membership) with security, OCR, and monetization.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/cardvault run dev` — run the Expo app (port 25453)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (esbuild bundle)
- Mobile: Expo SDK 54, expo-router v6, React Native
- Payments: Whop ($4.99/mo Pro subscription)
- AI/OCR: OpenAI GPT-4o Vision (`POST /api/ocr/scan-card`)

## Where things live

- `artifacts/cardvault/` — Expo mobile app
- `artifacts/api-server/src/routes/` — Express API routes (health, ocr, whop)
- `artifacts/api-server/src/whopClient.ts` — server-side Whop SDK singleton
- `artifacts/cardvault/contexts/` — CardContext, ProfileContext, ProContext
- `artifacts/cardvault/components/ProPaywall.tsx` — subscription paywall modal
- `artifacts/cardvault/app/edit-card.tsx` — card edit screen (regulated fields locked)
- `artifacts/cardvault/types/card.ts` — Card type definition

## Architecture decisions

- Government-issued cards (`id`, `health`) have locked core fields by regulation — only notes and photos are editable.
- Whop handles Pro subscription ($4.99/mo). ProContext caches access status in AsyncStorage (1hr TTL). Server is source of truth.
- OCR uses GPT-4o Vision via `/api/ocr/scan-card` — OPENAI_API_KEY must be set.
- Metro blockList in `metro.config.js` prevents ENOENT crashes from pnpm `_tmp_` dirs — must keep for any native packages.
- Expo camera permissions use `(cam as any).Camera.requestCameraPermissionsAsync()` — NOT a top-level export in expo-camera v17.

## Product

- Digitize cards with front/back photo capture + OCR auto-fill
- View cards in 3D Wallet with holographic flip animation
- Location-aware card suggestions (near gyms, pharmacies, etc.)
- Privacy blur on sensitive fields (hold to reveal)
- Biometric/PIN app lock
- AES-256 encrypted backup/restore
- Full-screen barcode display + live scanner
- 60-second verification QR
- Card sharing via shareable link
- Expiry notifications
- Pro subscription paywall (Whop)

## User preferences

- Regulated cards (`id`, `health`) must NOT allow editing of core identity fields.
- Dark navy/gold palette throughout.

## Gotchas

- Always keep `metro.config.js` blockList for `_tmp_` dirs — removing it crashes Metro with ENOENT.
- `expo-camera` v17: permissions are on `(cam as any).Camera`, not top-level exports.
- WHOP_COMPANY_ID and WHOP_PLAN_ID are Replit Configs (not env secrets) — already set.
- Pre-existing TypeScript errors in `app/add-card.tsx` and `lib/backup.ts` (expo-file-system dynamic import typing) — do not regress further.

## Pointers

- See the `pnpm-workspace` skill for workspace structure and TypeScript setup.
- Whop SDK: @whop/sdk@0.0.40 — `checkoutConfigurations.create()`, `memberships.list()`.
