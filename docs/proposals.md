# Proposals: Future Features

Created: March 18, 2026
Owner: Core maintainers
Status: Draft

Purpose
- Capture forward-looking feature proposals with clear outcomes and criteria.
- Give contributors a shared place to discuss, refine, and prioritize ideas.

How To Propose
1) Open a GitHub issue with label: proposal.
2) Use the template in this file: copy a section, adjust fields, and link the issue.
3) Discuss scope and tradeoffs in the issue before implementation.
4) When accepted, convert to a tracked task in the roadmap and link PRs.

Prioritization Rubric
- Impact: Expected user value and problem severity (1–5).
- Effort: Estimated person-weeks including testing and docs (1–5, lower is better).
- Confidence: Certainty in estimates (0.2–1.0).
- Reach: Percent of active users affected in a typical month (0–1.0).
- RICE Score: Reach × Impact × Confidence ÷ Effort.

At-a-Glance Ideas
| ID | Title | Outcome | Impact | Effort | Priority |
| -- | ----- | ------- | ------ | ------ | -------- |
| P1 | Plugin and Extension API | Third parties can extend core safely | 5 | 3 | High |
| P2 | Scripting and CLI | Repeatable automation for common tasks | 4 | 2 | High |
| P3 | Performance and GPU Acceleration | Faster operations on large projects | 5 | 3 | High |
| P4 | Import and Export Formats | Interop with common standards | 4 | 2 | Medium |
| P5 | Real-time Collaboration | Multiple users can co-edit | 4 | 5 | Medium |
| P6 | Accessibility and Keyboard-First UX | Fully usable without a mouse | 4 | 2 | High |
| P7 | Template and Asset Library | Faster starts with curated assets | 3 | 2 | Medium |
| P8 | Internationalization (i18n) | UI and docs localizable | 3 | 2 | Medium |

Detailed Proposals

## P1 — Plugin and Extension API
- Problem: Advanced users and teams need customization without forking the codebase.
- Proposal: Provide a stable extension surface for tools, formats, and UI panels.
- Scope: Registration, lifecycle hooks, permissions model, versioned API, sandboxing.
- Acceptance Criteria:
  - Sample plugin repository passes SDK validation and works across minor releases.
  - Plugins can declare and be denied permissions at load time.
  - Clear migration guide for breaking changes between API versions.
- Measure of Success: 5+ community plugins within one quarter after release.
- RICE: R=0.6, I=5, C=0.7, E=3 → 0.7.

## P2 — Scripting and CLI
- Problem: Repetitive tasks and batch operations are manual and error prone.
- Proposal: Add a scripting layer and a CLI for headless runs.
- Scope: Command discovery, dry-run mode, exit codes, templated tasks.
- Acceptance Criteria:
  - Users can run saved scripts against a folder of projects with logs.
  - CI example demonstrates non-interactive usage.
  - Documentation includes at least three end-to-end recipes.
- Measure of Success: 30 percent reduction in manual steps for common workflows.
- RICE: R=0.5, I=4, C=0.8, E=2 → 0.8.

## P3 — Performance and GPU Acceleration
- Problem: Large projects are slow during heavy operations.
- Proposal: Profile hot paths and add optional GPU acceleration where applicable.
- Scope: Benchmarks, frame budget targets, background indexing.
- Acceptance Criteria:
  - Benchmarks show at least 2x improvement on reference datasets.
  - No regressions in memory footprint for medium projects.
  - Performance CI guard rails added with thresholds.
- Measure of Success: 25 percent drop in performance-related issues over two releases.
- RICE: R=0.7, I=5, C=0.6, E=3 → 0.7.

## P4 — Import and Export Formats
- Problem: Users need to exchange files with other tools.
- Proposal: Add robust import and export for common formats with presets.
- Scope: Format adapters, error reporting, metadata preservation, unit tests.
- Acceptance Criteria:
  - Round-trip integrity tests pass for supported formats.
  - Export presets cover common target uses.
  - Clear warnings when features cannot be preserved.
- Measure of Success: Fewer user reports about interoperability gaps.
- RICE: R=0.6, I=4, C=0.8, E=2 → 0.96.

## P5 — Real-time Collaboration
- Problem: Teams cannot co-edit or review changes live.
- Proposal: Enable presence, cursors, comments, and conflict resolution.
- Scope: Document model for concurrency, offline queueing, audit trail.
- Acceptance Criteria:
  - Two users can edit the same project across networks with conflict handling.
  - Comments and suggestions can be resolved and merged.
  - Security review covers authentication, authorization, and data privacy.
- Measure of Success: At least one pilot team adopts collaboration for production work.
- RICE: R=0.3, I=4, C=0.5, E=5 → 0.12.

## P6 — Accessibility and Keyboard-First UX
- Problem: Some user flows are not accessible or are slow without a mouse.
- Proposal: Improve keyboard navigation, focus states, screen reader support, and contrast.
- Scope: WCAG 2.2 AA targets, shortcuts, discoverability, and docs.
- Acceptance Criteria:
  - Axe audits pass on key screens with no critical issues.
  - Every primary action has an accessible shortcut.
  - High contrast mode is available and documented.
- Measure of Success: Positive feedback from accessibility reviews and audits.
- RICE: R=0.8, I=4, C=0.8, E=2 → 1.28.

## P7 — Template and Asset Library
- Problem: New users face a blank canvas and slow starts.
- Proposal: Curated templates and reusable assets with search and tagging.
- Scope: Built-in gallery, remote catalogs, licensing metadata, versioning.
- Acceptance Criteria:
  - Users can browse, preview, and apply templates without leaving the app.
  - Assets track provenance and license information.
  - Template updates do not break existing projects.
- Measure of Success: Shorter time to first meaningful output for new users.
- RICE: R=0.5, I=3, C=0.8, E=2 → 0.6.

## P8 — Internationalization (i18n)
- Problem: Non-English users cannot use the interface effectively.
- Proposal: Externalize strings and add locale switching.
- Scope: ICU message format, pluralization rules, RTL support, locale packs.
- Acceptance Criteria:
  - English and one additional language are fully supported end to end.
  - Build pipeline extracts and validates translatable strings.
  - Documentation explains how to contribute translations.
- Measure of Success: Community contributed locale packs.
- RICE: R=0.4, I=3, C=0.9, E=2 → 0.54.

Changelog
- 2026-03-18: Initial draft of proposals and workflow.
