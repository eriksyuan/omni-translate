# Development

## Prerequisites

- Node.js 22+
- pnpm 11+
- Rust stable
- Tauri 2 prerequisites for the target OS

## Common Commands

```bash
pnpm install
pnpm tauri dev
```

### Quality Gates

```bash
pnpm typecheck       # TypeScript project references
pnpm lint            # ESLint flat config
pnpm format:check    # Prettier check
pnpm test            # Vitest unit tests
pnpm rust:fmt:check  # rustfmt check
pnpm rust:check      # cargo check
pnpm check           # frontend + Rust lightweight checks
```

### Fix Commands

```bash
pnpm lint:fix
pnpm format
pnpm rust:fmt
```

## pnpm Build Approval

pnpm 11 requires explicit approval for dependency build scripts. `esbuild` is approved in
`pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
```

## Cargo Registry

This project expects Cargo to use a sparse registry configuration. If `cargo check` reports a
duplicate `rsproxy` source, ensure `~/.cargo/config.toml` does not define a chained
`[source.rsproxy]` that points at the git `crates.io-index`.

## Testing Tauri Frontend Code

Vitest runs in `jsdom`. Tauri APIs are mocked in `src/test/setup.ts`, so React window components can
be tested without launching the desktop app.

## Source Boundaries

- `src/` contains React window UI and Tauri invoke wrappers.
- `src-tauri/` contains Rust commands, tray setup, providers, and platform abstractions.
- `open-design/` is design source only when present; do not edit it from implementation work.
