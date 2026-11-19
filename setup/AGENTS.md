# Coding agent guidance

## Coding practices

- Before introducing or changing test tooling or conventions, inspect the repository for an existing framework, custom runner, test scripts, or file layout. If you find an existing setup or cannot tell which convention to follow, pause before changing it and ask the user whether to keep it or migrate it. Follow a choice the user has already made.
- For behavior changes and bug fixes, write a focused failing test first, implement the change, then refactor with the test passing. When adding tests to existing code, capture current behavior first and record suspected bugs separately for review.
- Test observable behavior, failure paths, and regressions. Keep the suite maintainable by consolidating overlapping tests and removing obsolete tests when better tests cover the same behavior. Use synthetic fixtures and controlled test services.
- Preserve type information across module boundaries. Treat untrusted input as `unknown` until validated, and document any necessary assertion and the invariant that justifies it. Keep runtime validation at external boundaries such as configuration, HTTP, and database reads.
- Handle rejected promises, including deliberate background tasks. Account for cleanup, partial failures, and retries where relevant.
- Fix compiler and linter findings at the source. Give narrow exceptions a concrete reason. Keep mechanical formatting separate from behavior changes.

## Before each commit

- Review the complete staged change for bugs, gaps, oversights, unintended behavior, and sensitive data. Check adjacent callers when changing shared code.
- Before setting up Git hooks, inspect the effective hooks directory (`git rev-parse --git-path hooks`) and check for a hook manager. If existing hooks or a hook setup are present, pause and ask the user how to integrate the new check before changing any hooks or `core.hooksPath`. If there are none, proceed with setup.
- Keep the pre-commit checks enabled through the tracked hook or the user-approved integration. When it runs the full check suite, rely on it for that run and use focused checks during development. Avoid relying on unstaged fixes to pass the hook.
- During a tooling rollout, record the baseline before changing anything. Until the new aggregate check becomes required, run the applicable existing checks. Document pre-existing failures and verify the change introduces no new failures. Keep any check already required by the repository in force.
- Once the aggregate check passes and is adopted as required, keep it passing. If the hook is unavailable, run the required checks directly. If a required check cannot run, report the blocker and wait for guidance before committing.

## Safety and security

- Before pushing, audit every outgoing commit, including intermediate and merge commits, for credentials, sensitive data, and real identifiers in code, fixtures, logs, and documentation. Run a merge-aware secret scan with redacted output and review the diffs for sensitive content the scanner may miss. Stop the push if anything sensitive is found and remove it from the outgoing history before retrying.
- Minimize sensitive data in agent context and tool output. Prefer presence checks, counts, and redacted diagnostics. Keep real secrets and private configuration out of version control and use placeholders in examples.
- Ask for guidance before taking dangerous actions outside the authorized scope. Examples include sending data to an unrelated external service, posting publicly, modifying production, or rewriting shared history. Continue routine work within the existing authorization.

## Dependency changes

- Before changing dependencies, report the proposed versions, compatibility impact, and relevant security findings. Review the package source and lockfile diff, paying attention to unexpected registries, Git or tarball URLs, lifecycle scripts, and new transitive dependencies.
- Keep dependency changes isolated, normally one direct dependency per commit. Explain when tools need to be upgraded together. Keep unrelated lockfile churn out of the change.
