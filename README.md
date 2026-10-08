# Politost content

Everything that defines and handles a Politost smartbook outside the reader: the format spec, the TypeScript parser and validator, and the Python pack CLI.

| Directory | What it is | License | Released as |
|-----------|------------|---------|-------------|
| [`spec/`](spec) | Content format specification, version in [`spec/VERSION`](spec/VERSION) (1.2) | AGPL-3.0 | Part of the repository |
| [`packages/content-core/`](packages/content-core) | `@politost/content-core`: parser, renderer, validators, `.ptsb` reader | MIT | npm tarball on each `content-core-v*` release |
| [`packages/ptsb-pack/`](packages/ptsb-pack) | `ptsb-pack` CLI: validate, pack, encrypt and inspect `.ptsb` files | AGPL-3.0 | `pip install` from a tag |

Until October 2026 these were three repositories. `politost-content-format` and `politost-ptsb-pack` were merged here with their history. Their old commits sit behind the import merges, so `git log -- spec` does not reach them. Use `git log 21dfcac^2` (content-format) and `git log eb7e5e6^2` (ptsb-pack).

## Using it

content-core, pinned to a release tarball:

```bash
npm install https://github.com/SuperTost100/politost-content-core/releases/download/content-core-v0.3.0/politost-content-core-0.3.0.tgz
```

ptsb-pack, pinned to a tag:

```bash
pip install "git+https://github.com/SuperTost100/politost-content-core.git@ptsb-pack-v1.1.0#subdirectory=packages/ptsb-pack"
```

Consumers: the [reader](https://github.com/SuperTost100/politost-smartbook) keeps a copy in `packages/content-core`, Smart Builder pins the tarball URL, Pyxis vendors the tarball, the platform vendors ptsb-pack.

## Changing the format

One pull request covers the whole change:

1. Edit `spec/content-format.md` and, if the syntax or the validation rules change, bump `spec/VERSION` and `CONTENT_FORMAT_VERSION` in `packages/content-core/src/bookMeta.ts`. content-core's tests fail if the two differ.
2. Update the parser and validator in content-core, and the matching checks in `packages/ptsb-pack/ptsb_pack/validate.py`.
3. Bump the package versions you changed.

CI runs both test suites on every push.

## Releasing

content-core: bump `version` in `packages/content-core/package.json`, merge, then push an annotated tag whose message is the release notes:

```bash
git tag -a content-core-v0.3.1 -F notes.md && git push origin content-core-v0.3.1
```

The release workflow checks the tag against `package.json`, runs the tests and attaches `politost-content-core-<version>.tgz`.

ptsb-pack: bump `version` in `packages/ptsb-pack/pyproject.toml`, merge, then push a `ptsb-pack-v<version>` tag. pip installs straight from the tag.

Tags `v0.1.0` to `v0.2.1` are content-core releases from before the merge.
