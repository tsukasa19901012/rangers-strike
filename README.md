# Rangers Strike

Legend 1 TCG simulator monorepo.

## Packages

| Package | Description |
|---------|-------------|
| `packages/cards` | Card definitions and effect catalogs |
| `packages/engine` | Game rules engine |
| `apps/web` | Next.js play UI |

## Setup

```bash
npm ci
```

## Development

```bash
# Web app at http://localhost:3000
npm run dev

# Typecheck
npm run typecheck
```

## Tests

```bash
npm test
```

Per package:

```bash
npm test -w @rangers-strike/cards
npm test -w @rangers-strike/engine
```

## Build

```bash
npm run build
```

## Implementation catalogs

- NC wiring: `packages/cards/src/comboEffects.ts`
- Joint / riding combo: `packages/cards/src/comboEffectCatalog.ts`
- Unit effects: `packages/cards/src/unitEffectCatalog.ts`
- Operations: `packages/cards/src/operationCatalog.ts`
- Effect labels: `packages/cards/src/effectLabels.ts`
