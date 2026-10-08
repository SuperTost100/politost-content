# Politost content format

Canonical specification for Politost Smartbook markdown, `smartbook.json`, exercises, and assets.

| Field | Value |
|-------|-------|
| Spec version | See `VERSION` |
| Status | Stable for PTSB v1 |

## Document

- [content-format.md](./content-format.md): full specification (in Italian)

## Related projects

| Repo | Role |
|------|------|
| [politost-smartbook](https://github.com/SuperTost100/politost-smartbook) | OSS reader |
| [`packages/content-core`](../packages/content-core) | Parser, renderer, validator |
| [`packages/ptsb-pack`](../packages/ptsb-pack) | `.ptsb` pack CLI |
| [politost-smartbook-builder](https://github.com/SuperTost100/politost-smartbook-builder) | Authoring app |

Syntax changes need a version bump in `VERSION` and in `CONTENT_FORMAT_VERSION` (content-core's tests fail if the two differ), then updates in the reader and the builder.
