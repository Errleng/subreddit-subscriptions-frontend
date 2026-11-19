# Upgrade an existing TypeScript repository

Start here after copying the `setup/` folder into the target repository. Run commands from the target repository's root and document the commands you adopt in its README. The examples use npm, one Node package, and GitHub Actions. Adapt the paths, commands, and module settings to the existing project. For a workspace, use the existing package manager and run the aggregate checks across all affected packages.

## 1. Audit sensitive data before the first push

- Before installing tools or editing files, review tracked files and staged changes for credentials and sensitive data, including logs, error output, configuration, fixtures, and examples. Check that private environment files are ignored and untracked. Use presence checks or redacted diagnostics to verify private configuration. If needed, prepare a checked-in example with placeholders that separates credentials, private identifiers, and ordinary settings.
- Fetch the destination refs before pushing and identify exactly which commits will go out. Review every outgoing commit, including intermediate changes and changes introduced in merges. For an update from `origin/main` to `HEAD`, one example scan is `gitleaks git --log-opts='--diff-merges=separate origin/main..HEAD' --redact=100 .`. Change the range to match the actual push and review the diffs for private identifiers and records the scanner may miss. Scan the reachable history of each ref when publishing a repository for the first time.
- Resolve findings before pushing. If a credential has already reached a remote, revoke or rotate it first. Coordinate any shared history rewrite separately so collaborators can move to the cleaned history safely. Repeat the outgoing audit before every push, including the push that adds CI.

## 2. Record the baseline

- Identify the existing Node version, package manager and lockfile, module system, build entry points, current test and lint tools, and any native prerequisites. Use the existing Node version and lockfile (`npm ci` for npm) to run and document the current build, tests, and checks. Record any failures or unavailable commands before editing. If the original runtime or lockfile is unavailable, record what could and could not be verified.
- After the baseline, copy [AGENTS.md](./AGENTS.md) to the target repository root and merge it with any existing instructions. If upgrading Node, choose a supported LTS compatible with deployment and dependencies, rerun the baseline checks on it, and keep the runtime change separate. Record the supported version in `.nvmrc` or the project's equivalent and point CI at the same file.
- During rollout, use the baseline to verify that each change introduces no new failures. Leave any existing required gates in force and adopt the new aggregate check as required once it passes.
- Break the work into reviewable commits. Keep test infrastructure, test expansion, bug fixes, compiler tightening, lint changes, formatting, and CI changes separate where practical. Keep unrelated application upgrades out of the tooling work.
- Review dependency updates with the lockfile diff and a vulnerability check where appropriate. Use `npm audit` as one signal if the registry and repository policy allow it. Consider automated dependency alerts separately from the secret scan. Avoid applying automated major upgrades just to clear a report.

## 3. Establish tests before changing behavior

Inspect test dependencies, scripts, CI commands, configuration, and test files to identify the current runner and conventions. If you find an existing framework, custom runner, or established test layout, or the setup is unclear, stop before changing it and ask the user whether to keep it or migrate it. Follow any choice the user has already made. If there is no existing setup, proceed with the agreed stack.

If keeping the current runner, use its coverage and discovery features in the later check and CI steps. If migrating, keep the old suites running alongside the new ones until you have accounted for each suite and verified the migrated checks still cover its behavior. To adopt Vitest, install Vitest and the matching V8 coverage provider together. If the latest versions require a newer Node runtime or conflict with an existing Vite setup, select compatible versions before installing.

```sh
npm install --save-dev --save-exact vitest @vitest/coverage-v8
```

Migrate existing tests while preserving their assertions. One useful layout is `tests/unit/`, mirroring `src/`, plus `tests/integration/` for real boundaries that can be exercised locally. A project with colocated tests can keep that layout and adjust the discovery globs. Put disposable fixtures next to their tests and extract helpers when multiple tests need them.

Example `vitest.config.ts` for the separate test directories:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
        passWithNoTests: false,
        allowOnly: false,
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.d.ts"],
            reporter: ["text", "html", "json-summary"],
        },
    },
});
```

Use deterministic inputs, synthetic identifiers, and cleanup for timers, processes, files, and test databases. Mock external APIs or use local test servers. Tests should run without production credentials or an existing developer database. Add a compiled-output smoke test if production launches emitted JavaScript. If the project ships migrations, exercise them on a disposable database, including migration from representative older schema states.

Cover existing behavior and key failure paths first. Record suspected bugs separately, then review and address them in individual fixes with regression tests. Use coverage to find untested paths and review whether the assertions would catch a meaningful failure. Enable the thresholds once the suite reaches them. Add this inside `coverage` for a project-wide 90% minimum on each metric:

```ts
thresholds: {
    lines: 90,
    statements: 90,
    functions: 90,
    branches: 90,
},
```

If you parallelize test work, assign each worker a specific test file or source area. The worker edits only its assigned tests and reports shared fixture or source changes to the coordinator. The coordinator handles shared edits and reviews each contribution before committing.

## 4. Tighten TypeScript in stages

Keep the production compiler configuration aligned with the real runtime or bundler. Confirm that the build includes all production source, that test files stay out of emitted production output, and that failed builds cannot emit new output (`noEmitOnError` for `tsc`). Old output can remain on disk after a failed build, so CI should build in a fresh checkout and deployment should launch only after a successful build.

Enable `strict`, then consider `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, and `noUnusedParameters` in manageable batches. Fix findings with type narrowing, correctly modeled absence, and explicit handling of edge cases. Keep validation for environment variables, request bodies, and external data at runtime.

Add a test typecheck configuration that extends the production rules, covers source, tests and Vitest config, and emits no output. For a single non-composite package with `src/` and `tests/`:

```json
{
    "extends": "./tsconfig.json",
    "compilerOptions": { "rootDir": ".", "noEmit": true },
    "files": [],
    "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"],
    "exclude": ["node_modules", "dist", "coverage"]
}
```

Save it as `tsconfig.test.json`. Adjust inherited `lib`, `types`, references, or build settings to match the test environment. If third-party declarations fail, check that the compiler and package versions are compatible. If the project intentionally uses `skipLibCheck`, document that it skips checking declaration files while still type-checking application and test code. If type-aware lint cannot find the test project, add a `tests/tsconfig.json` that extends `../tsconfig.test.json` and verify that a test file receives type-aware diagnostics.

## 5. Add type-aware linting and formatting

```sh
npm install --save-dev --save-exact oxlint oxlint-tsgolint
npm install --save-dev --save-exact oxfmt
```

Start `.oxlintrc.json` with the following settings. Adjust globals to the actual runtime and check that both source and tests are included in a TypeScript project.

```json
{
    "$schema": "./node_modules/oxlint/configuration_schema.json",
    "options": {
        "typeAware": true,
        "denyWarnings": true,
        "reportUnusedDisableDirectives": "error"
    },
    "plugins": ["typescript", "oxc", "unicorn"],
    "categories": { "correctness": "error" },
    "env": { "node": true, "es2021": true },
    "ignorePatterns": ["node_modules/**", "dist/**", "coverage/**"],
    "rules": {
        "typescript/no-floating-promises": ["error", { "ignoreVoid": false }],
        "typescript/no-misused-promises": "error",
        "typescript/await-thenable": "error",
        "typescript/no-unsafe-assignment": "error",
        "typescript/no-unsafe-argument": "error",
        "typescript/no-unsafe-call": "error",
        "typescript/no-unsafe-member-access": "error",
        "typescript/no-unsafe-return": "error",
        "typescript/switch-exhaustiveness-check": "error"
    }
}
```

If replacing another linter, compare the old rules with the new ones and preserve meaningful protections before removing the old tool. Verify a temporary floating-promise or unsafe-value probe fails lint, then remove it. Keep `tsc` as the authority for compiler diagnostics.

Configure `.oxfmtrc.json` and `.editorconfig` to match the existing conventions where possible. In Oxfmt, `tabWidth`, `printWidth`, `semi`, and `singleQuote` control the basic style. Start with `sortImports: false` to preserve import order and set `ignorePatterns` to exclude generated output, vendor files, private environment files, and lockfiles. Run `npm run format` after adding the scripts below and commit the mechanical changes separately. Optionally record that commit in `.git-blame-ignore-revs` and document how developers can enable it.

## 6. Wire up one local check command

Merge the applicable scripts into `package.json`. The test scripts below are for a completed Vitest migration or a new Vitest setup. If using another runner or still migrating, keep the existing test entry points and ensure `check` runs every active suite. Keep the existing production `build` script. The example assumes the root `tsconfig.json` is the production compiler config.

```json
{
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest",
        "test:coverage": "vitest run --coverage",
        "typecheck": "tsc --noEmit -p tsconfig.json && tsc -p tsconfig.test.json",
        "lint": "oxlint .",
        "lint:fix": "oxlint --fix .",
        "format": "oxfmt --write .",
        "format:check": "oxfmt --check .",
        "check": "npm run build && npm run typecheck && npm run lint && npm run format:check && npm run test:coverage"
    }
}
```

If `build` uses `tsc --build` with incremental output, use a forced or clean build in `check` so old build metadata cannot skip verification. If the project uses a bundler, retain its build command and keep `tsc` as a separate check.

Before adding or activating hooks, check the effective hooks directory with `git rev-parse --git-path hooks` and look for existing hook management in the repo. If you find existing hooks or a hook manager, pause and ask the user how to integrate the new check. Follow the approved integration and preserve all existing hooks. Changing `core.hooksPath` changes lookup for every Git hook.

If there is no existing hook setup and `npm run check` passes, adopt it as the required check and add `.githooks/pre-commit`:

```sh
#!/bin/sh
exec npm run check
```

During the initial rollout, stage the hook with its executable bit set:

```sh
chmod +x .githooks/pre-commit
git add .githooks/pre-commit
```

For each development clone using the tracked hook, document this one-time activation. First repeat the check for existing hooks in that clone. Run the command only in a clone without an existing hook setup. If the clone already uses the tracked hook or an approved integration, keep it enabled.

```sh
git config --local core.hooksPath .githooks
```

The hook checks the working tree, so keep unrelated unstaged changes out of a commit and rely on CI to check the committed snapshot. Keep auto-fix commands explicit so a check doesn't rewrite files.

## 7. Run the checks and secret scan in CI

For GitHub Actions, add `.github/workflows/checks.yml`. Replace the placeholders with verified full commit SHAs from the upstream action repositories before committing the workflow.

```yaml
name: Build and Test

on: [push, pull_request, workflow_dispatch]

permissions:
    contents: read

jobs:
    check:
        runs-on: ubuntu-latest
        timeout-minutes: 15
        steps:
            - uses: actions/checkout@<VERIFIED_CHECKOUT_SHA>
              with:
                  persist-credentials: false
            - uses: actions/setup-node@<VERIFIED_SETUP_NODE_SHA>
              with:
                  node-version-file: .nvmrc
                  cache: npm
            - run: npm ci --include=dev
            - run: npm run check
```

Install any project-specific OS build dependencies before `npm ci`. Keep the test suite nonempty in CI. If the project intentionally lets an empty suite pass locally, add an explicit CI assertion that `vitest list --filesOnly --json` returns at least one test file.

Add a separate secret scan on pushes and pull requests. Use a pinned Gitleaks binary or action that can scan merge diffs. Fetch enough history to inspect every commit in scope (`fetch-depth: 0` for full history), and redact results without uploading raw findings.

Keep scanner rules and approved exceptions in a trusted source, such as a protected branch or a centrally managed workflow. Scan a temporary bare copy of the checked-out Git revision to keep the proposed change's working-tree config and ignore files out of the scan. Verify that the bare copy's `HEAD` matches the revision being checked, including the test merge commit on GitHub pull requests. Pass the trusted config and exception file explicitly, and use `--ignore-gitleaks-allow` to disable inline suppressions. If using the default rules, point `--config` at a trusted file containing `[extend]` and `useDefault = true`. Use an empty trusted ignore file when there are no approved exceptions. A repository workflow can itself be changed in a pull request. If the scan needs to enforce policy independently of the change under review, use a required workflow defined outside that change.

Example CI shell step from the checkout root. `trusted_dir` must already point to a directory containing the approved policy files.

```sh
set -eu
scan_dir=$(mktemp -d)
trap 'rm -rf "$scan_dir"' EXIT
bare_repo="$scan_dir/scan.git"
git init --bare "$bare_repo"
git -C "$bare_repo" fetch --no-tags "$PWD" HEAD
git -C "$bare_repo" update-ref refs/heads/scan FETCH_HEAD
git -C "$bare_repo" symbolic-ref HEAD refs/heads/scan
test "$(git -C "$bare_repo" rev-parse HEAD)" = "$(git rev-parse HEAD)"

gitleaks git --log-opts='--full-history --diff-merges=separate HEAD' \
    --config "$trusted_dir/gitleaks.toml" \
    --gitleaks-ignore-path "$trusted_dir/.gitleaksignore" \
    --ignore-gitleaks-allow --redact=100 "$bare_repo"
```

This scans the history reachable from the checked revision. If using a narrower range, fall back to that revision's full history when a base is unavailable, as can happen with new branches or force pushes. In a disposable repository, verify that the scan catches a synthetic marker introduced only in a merge commit and removed later. Also verify that adding an ignore entry to the scanned revision does not suppress the finding.

If the project uses a protected default branch, make both checks required in the branch protection or ruleset settings and verify they actually gate a PR. CI scans happen after GitHub receives the commits, so keep the local audit before pushing.

## Completion checks

- A fresh clone with the documented Node version can install from the lockfile and run `npm run check` without production credentials.
- The build emits runnable production output. The compiler checks source and tests, lint has verified type-aware rules, and formatting checks leave files untouched.
- Coverage thresholds are active. Test discovery, a failing or focused test, a lint violation, and a formatting violation each fail their intended gate. Use temporary changes and remove them after verifying.
- The tracked hook or the approved hook integration runs the aggregate check. CI runs build and test checks and the history-aware secret scan. Verify separately whether the default branch requires them.
- The README records setup commands, test conventions, and any remaining integration or deployment checks. The root `AGENTS.md` reflects the target repository's actual workflow.
