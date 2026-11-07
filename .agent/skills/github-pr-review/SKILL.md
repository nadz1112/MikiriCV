---
name: github-pr-review
description: Review GitHub pull request changes for consequential correctness, data isolation, privacy, and security issues in the MikiriCV application. Use when asked to review a PR or a proposed diff.
---

# GitHub PR review for MikiriCV

Review the pull request diff together with the surrounding code and applicable project guidance. Focus on defects introduced by the change that can cause incorrect behavior, data exposure, broken access boundaries, or security problems. Do not make code changes while reviewing.

## Review process

1. Read the root `AGENTS.md` and applicable `.agent/rules/` guidance.
2. Inspect the full diff, then read the relevant callers, interfaces, schemas, and existing error-handling paths to confirm each suspected issue.
3. Trace data ownership and authorization from the route through the controller, service, and repository. Check that CV and job data remain within the intended account boundary.
4. Check file upload, download, deletion, and AI matching changes against the project invariants in `.agent/rules/01-architecture.md`.
5. Report only actionable findings caused by this diff. Omit style preferences, speculative concerns, and issues already present in the base branch. Do not claim tests or checks were run unless they were actually run.

## Findings

- Lead with findings, ordered by severity: P1 before P2 and lower-priority notes only when clearly actionable.
- For each finding, give the severity, file and line, the concrete failure scenario, and the impact. Keep the explanation concise.
- If there are no findings, say so clearly and mention any important area that could not be assessed.
- Do not change files or post a GitHub review unless the user explicitly asks for that action.

## MikiriCV review focus

- Verify that tenant-owned CVs, jobs, and matching results cannot be read, changed, or deleted across accounts, including through nested IDs and bulk operations.
- Protect candidate personal data: do not expose raw CV text, extracted search text, private file paths, or uploaded files through list APIs, public static routes, logs, or error responses.
- Preserve matching behavior: only score candidates explicitly selected by the user; represent AI failures as failures rather than fabricated scores; keep concurrency bounded.
- Check uploads and downloads for validation, path traversal, authorization, and cleanup ordering. A database deletion must succeed before deleting the associated file.
- Keep Gemini credentials and other secrets server-side, and route provider access through the existing provider interface.
