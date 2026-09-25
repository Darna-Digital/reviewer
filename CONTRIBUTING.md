# Contributing to Reviewer

Thanks for taking the time to contribute! Bug reports, feature ideas,
documentation fixes and code are all welcome.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs and requesting features

- Search [existing issues](https://github.com/Darna-Digital/reviewer/issues)
  first — someone may have reported it already.
- Open a [bug report](https://github.com/Darna-Digital/reviewer/issues/new?template=bug_report.yml)
  or a [feature request](https://github.com/Darna-Digital/reviewer/issues/new?template=feature_request.yml)
  using the templates. For bugs, include your Reviewer version (**Reviewer →
  About Reviewer**), your macOS version and the steps that reproduce it.
- Found a security issue? Don't open a public issue — follow
  [SECURITY.md](SECURITY.md).

## Setting up the project

You'll need an Apple silicon Mac on macOS 26 with Xcode 26, Xcode's Metal
toolchain, Node.js (current LTS) and pnpm 11:

```bash
xcodebuild -downloadComponent MetalToolchain
```

```bash
corepack enable
```

```bash
pnpm install
```

Then run the API server and the SPA in one terminal, and build and open the
app from another:

```bash
pnpm dev
```

```bash
pnpm dev:mac
```

The [README](README.md#development) describes what each package in the
monorepo does.

## Making a change

1. Fork the repository and create a branch from `staging` — development
   happens there, and `main` only holds what has shipped.
2. Keep the change focused: one fix or feature per pull request.
3. Match the style of the code around it. ESLint and Prettier are configured
   for the TypeScript packages; run them before you push:

   ```bash
   pnpm lint
   ```

   ```bash
   pnpm format:check
   ```

   ```bash
   pnpm typecheck
   ```

   ```bash
   pnpm -r --if-present test
   ```

4. For changes to the Mac app, make sure a release build still succeeds:

   ```bash
   pnpm build:mac
   ```

5. Include screenshots or a short screen recording for anything visible in the
   UI — light and dark appearance if the change affects both.
6. Open a pull request against `staging` and fill in the template.

CI runs lint, formatting and tests on every pull request, and builds
`Reviewer.app` on a macOS 26 runner for anything outside the website and docs.

## Releases

Maintainers cut releases by bumping the version on `main`; GitHub Actions
builds, signs, notarizes and publishes them. See [RELEASING.md](RELEASING.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
