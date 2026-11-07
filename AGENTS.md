# Code Review Rules

### Candidate and job data

- Flag changes that allow one account to read or mutate another account's candidates, jobs, files, or matching results. Verify ownership checks for every requested ID, including bulk operations.
- Keep CV content private: list and search responses must not expose raw CV text, extracted search text, or file paths, and uploaded files must be served only through the authorized download flow.

### AI matching

- Matching must use only candidate IDs explicitly selected by the user, and AI/provider failures must remain visible as failures rather than being converted into a plausible score.
- Keep matching concurrency bounded and preserve the provider abstraction when changing AI calls.
