---
name: security-review
description: Review sensitive Typio changes involving access, secrets, personal data, or trust boundaries; also use for requested security audits.
---

# Security Review

Own targeted security analysis, not general code review or the test pipeline. Skip a full audit for unrelated UI/documentation changes. A requested release audit may examine the implemented attack surface beyond the diff.

## Analyze the actual surface

Establish scope and revision, entry points, untrusted inputs, protected data, and roles actually present. Trace suspected inputs to sensitive operations and verify mitigations. Consult installed framework documentation when needed.

Select relevant checks:

- Authentication/session verification, expiry, invalidation, cookie settings, and applicable cross-site request protection.
- Server-side authorization for protected actions and objects, including cross-user access; UI visibility is not access control.
- Boundary validation and relevant injection, unsafe rendering, redirects, uploads, paths, or outbound-request risks.
- Secret exposure in client bundles, commits, logs, or responses. Report location/type, never the value; recommend rotation after confirmed exposure without performing it unasked.
- Unnecessary personal data collection/exposure and relevant storage/deletion requirements.
- Reachable resource-exhaustion or abuse scenarios.
- Dependency/configuration vulnerabilities: verify locked versions against current authoritative advisories, distinguish development/runtime exposure and exploit prerequisites. Scanner output alone does not establish exploitability; disclose unavailable advisory access.

Use local/test reproductions with synthetic data. Do not perform destructive tests, probe external systems, or access real users' data without authorization. Review-only work does not install scanners, auto-fix dependencies, or change application code.

Reuse applicable code-review findings and the [QA validation record](../qa/SKILL.md). Run only focused security checks needed to resolve uncertainty; add results to that record. Do not rerun general tests, lint, or build. After authorized remediation, reassess the affected boundary and let QA coordinate regression checks.

## Report

In the user's language, give severity, verified location, prerequisites, attacker action, impact, evidence, and focused remediation. Distinguish confirmed vulnerabilities from conditional risks. Do not duplicate an existing finding; add security-specific evidence to it.

Use **Changes requested** for confirmed blocking vulnerabilities, **Review incomplete** for essential missing evidence, or **No blocking findings** for the reviewed scope. Disclose limitations and non-blocking findings; a clean review is not a guarantee of security. Follow [git-branch](../git-branch/SKILL.md) for any later merge authorization.
