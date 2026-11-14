# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0]

Not yet published to npm. Set the date here when the `v0.2.0` release is created.

### Removed

- **Breaking:** Node.js 20 support. Node.js 20 reached end of life on 2026-04-30; Node.js 22 or later is now required (`engines.node` is `>=22`).

### Changed

- The package is built with TypeScript 7. The published JavaScript and type declarations keep the same API.

### Added

- npm releases are published from GitHub Actions with Trusted Publishing and provenance.

## [0.1.0] - 2026-08-14

### Added

- Deterministic glossary matching with NFKC normalization, Latin/digit word boundaries, and CJK substring matching.
- Suppression of terms contained in a longer match, and same-span conflict reporting.
- Glossary linting for duplicate IDs, duplicate aliases, and nested aliases.
- Prompt formatting for a target locale, and the `glossary-match` CLI.

[Unreleased]: https://github.com/kiyohara1021/glossary-match/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/kiyohara1021/glossary-match/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kiyohara1021/glossary-match/releases/tag/v0.1.0
