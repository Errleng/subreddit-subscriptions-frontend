# SubredditSubscriptionsFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.11.

## Setup

The frontend uses Angular 22. From the repository root, install the Node version pinned in `.nvmrc` and use npm with the checked-in lockfile.

```sh
nvm install
npm ci
```

The test suite uses Karma and Jasmine. Colocate `*.spec.ts` files with the Angular components and services they exercise. Chrome or Chromium is needed for browser tests. Set `CHROME_BIN` if the Karma launcher cannot find your browser.

| Command | Purpose |
| --- | --- |
| `npm start` | Start the local Angular development server. |
| `npm run build` | Build the production browser bundle. |
| `npm run typecheck` | Check the application and specs using their Angular TypeScript projects. |
| `npm test` | Run the browser tests in watch mode. |
| `npm test -- --watch=false --browsers=ChromeHeadless --code-coverage` | Run the current suite once and report coverage. |
| `npm run lint` | Run type-aware Oxlint on the source and specs. |
| `npm run format:check` | Check formatting without writing files. Use `npm run format` to apply it. |

The TypeScript projects use `skipLibCheck` to skip checking dependency declaration files. Application and test files are still type-checked.

### Setup baseline

At `6a90b61`, a clean lockfile install, the production build, and both TypeScript checks passed on Node 22.23.4 and npm 10.9.9. The build warned about the initial bundle budget and four Bootstrap CSS selectors.

Karma discovered 18 tests. Eight passed, nine failed because standalone components were declared in TestBed, and one failed because the test lacked an HTTP provider. The run reported 34.23% statements, 44.16% branches, 30.12% functions, and 34.16% lines.

The production build, both TypeScript checks, and a browser smoke test passed after upgrading to Angular 22.3.0 on Node 22.23.4 and npm 10.9.9. The production bundle fits the existing 1 MB limit. Karma ran 18 tests, with nine passing and the nine standalone component failures still present.

The new lint rules expose existing unsafe values and a floating promise. The formatter check reports existing style differences. The aggregate check, coverage thresholds, pre-commit hook, and build-and-test workflow are pending the Vitest migration and a passing suite. Oxfmt's Tinypool version is pinned to a patched release.

The secret-scan workflow uses pinned Gitleaks with redacted findings and includes merge diffs. GitHub reports that the default branch is protected. The hosted workflow and required status checks still need verification. Before pushing, follow the outgoing-history audit in [the setup guide](setup/SETUP.md).

## Development server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
npm run build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
npm test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
