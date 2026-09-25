# Security Policy

## Supported versions

Only the latest release of Reviewer receives security fixes. The app updates
itself, so make sure you're on the newest version before reporting.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report it privately through
[GitHub's vulnerability reporting](https://github.com/Darna-Digital/reviewer/security/advisories/new)
instead. Include:

- what the issue is and what an attacker could do with it,
- the Reviewer and macOS versions affected,
- steps or a proof of concept that reproduce it.

We'll acknowledge the report within a few working days, keep you updated while
we work on a fix, and credit you in the release notes unless you'd rather stay
anonymous.

## Scope

Reviewer runs a local API server on `127.0.0.1` and launches coding agents and
terminal processes on your behalf. Issues that let another local user, a web
page, or a repository's contents reach that server or run commands you didn't
ask for are especially in scope.
