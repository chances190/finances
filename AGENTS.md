# Agent instructions for this project

## TypeScript check
```bash
bun run typecheck
```

## Lint & format
```bash
bun run lint
bun run format
```

Or use directly:
```bash
bunx biome check src/
bunx biome check --write src/
```

## Build
```bash
bun run build
```

## Dev server
```bash
bun run dev
```

## Project conventions
- Package manager: **bun** (not npm, not npx)
- Style: Tailwind v4 + shadcn/ui (Base UI Nova preset)
- Architecture: Clean Architecture (domain → application → data → ui)
- Always run `bun run typecheck` and `bun run format` before committing
- Never add comments to code unless explicitly asked
- Never create README or doc files unless explicitly asked
- Default exports for page components, named exports for utilities
