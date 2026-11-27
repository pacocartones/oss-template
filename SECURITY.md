# Security policy

## Reporting a vulnerability

Please do **not** open a public issue, pull request or discussion for a security problem.

Report it privately through the repository's **Security** tab: **Report a vulnerability** ([GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)). Include:

- what is affected (file, package version or commit);
- how to reproduce it, and what an attacker could do with it;
- any fix or mitigation you suggest.

You should get a first answer within 3 working days (best effort). Once the issue is confirmed, a fix is prepared in private and a security advisory is published with credit to you, unless you prefer to stay anonymous.

## Supported versions

Only the latest release receives security fixes (the default branch, until the first release).

## Scope

In scope: the code in this repository and its GitHub Actions workflows (`.github/workflows/`).

Out of scope: vulnerabilities in third-party services or dependencies; report those upstream. A wrong fact the project ships is a correction, not a security issue: use the data correction issue form.

## Automation and permissions

Workflows declare `permissions: {}` at the top and the narrowest permissions per job. No workflow that checks out or runs pull-request code has write permissions or repository secrets. The reusable workflows and their rules live in [`pacocartones/.github`](https://github.com/pacocartones/.github#security-rules).
