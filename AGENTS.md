# Agent instructions for this project

## TypeScript check
```bash
bun run typecheck
```

## Tests
```bash
bun test
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
- Style: Tailwind v4 + shadcn-svelte (bits-ui, Nova preset)
- Architecture: Clean Architecture (domain → application → data → ui)
- Always run `bun run typecheck` and `bun run format` before committing
- Never add comments to code unless explicitly asked
- Never create README or doc files unless explicitly asked
- Default exports for page components, named exports for utilities

## Svelte 5 — MCP first
The configured Svelte MCP server (`svelte` in `opencode.jsonc`) is the source of truth; this file deliberately does not restate its rules.

- Before writing or reviewing `.svelte` / `.svelte.ts` code, call `svelte` → `list-sections`, then `get-documentation` for every relevant section (runes, snippets, attachments, reactivity, best practices, TypeScript, testing).
- After editing a component, call `svelte` → `svelte-autofixer` with the installed Svelte version (read it from `node_modules/svelte/package.json`) and the component filename. Fix every issue and re-run until clean.
- For third-party Svelte libraries (bits-ui, shadcn-svelte, `@tanstack/svelte-virtual`, chart.js, phosphor-svelte), resolve the library in Context7 first; use DeepWiki for repository-level behaviour.
- Prefer the generated primitives in `src/components/ui` and inspect their props before adding wrappers.
- If the MCP is unavailable, stop and ask rather than guessing Svelte APIs.
