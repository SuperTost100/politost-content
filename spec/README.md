# Politost content format

Canonical specification for Politost Smartbook markdown, `smartbook.json`, exercises, and assets.

| Field | Value |
|-------|-------|
| Spec version | See `VERSION` |
| Status | Stable for PTSB v1 |

## Document

- [content-format.md](./content-format.md) — full specification

## Related projects

| Repo | Role |
|------|------|
| [politost-smartbook](https://github.com/SuperTost100/politost-smartbook) | OSS reader |
| [politost-content-core](https://github.com/SuperTost100/politost-content-core) | Parser, renderer, validator |
| [politost-ptsb-pack](https://github.com/SuperTost100/politost-ptsb-pack) | `.ptsb` pack CLI |
| [politost-smartbook-builder](https://github.com/SuperTost100/politost-smartbook-builder) | Current authoring app (private) |

Syntax changes require a version bump in `VERSION` and coordinated updates in content-core, reader, and builder.
