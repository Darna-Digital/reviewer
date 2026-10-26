# @reviewer/lint

Shared [oxlint](https://oxc.rs) and [oxfmt](https://oxc.rs) setup for the
reviewer.sh monorepo.

Unlike the ESLint and Prettier setup it replaces, nothing is extended
per package: this package owns the only config, and its scripts run the two
tools from the repo root across the whole workspace. Packages carry no lint or
format scripts and no lint dev dependencies of their own.

## Usage

From the repo root:

```bash
pnpm lint          # oxlint
pnpm lint:fix      # oxlint --fix
pnpm format        # oxfmt, writes in place
pnpm format:check  # oxfmt --check
```

## Configuration

- `.oxlintrc.json` — `correctness` rules, plus `rules-of-hooks` everywhere and
  `exhaustive-deps` in the packages that enforced it under ESLint. Its comments
  explain each rule that is turned off.
- `.oxfmtrc.json` — the formatting options Prettier used here (semicolons,
  double quotes, 80 columns, `es5` trailing commas), with overrides for the
  TUI's single-quote house style and for Tailwind class sorting, which oxfmt
  does itself in place of `prettier-plugin-tailwindcss`.
- `.oxfmtignore` — generated files, on top of `.gitignore`.

The `check` GitHub Action (`.github/workflows/check.yml`) runs `pnpm lint` and
`pnpm format:check` on every pull request.
