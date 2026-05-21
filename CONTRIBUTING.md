# Contributing

L5E is early-stage software. The most useful contributions are small, reproducible and tied to
the documented scope.

Before opening a PR:

1. Run `pnpm build`.
2. Run `pnpm test`.
3. Run `pnpm typecheck`.

Contribution rules:

- keep core small
- prefer docs or examples for niche workflows
- add tests for behavior changes
- do not introduce app-specific assumptions into framework code
- discuss large API changes before implementation

Bug reports should include a minimal reproduction or a failing test.
