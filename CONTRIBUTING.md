# Contributing

Changes to the format touch the spec, the parser and the validators together, so they go in one pull request. Run the [tests](README.md#development) before you push. CI runs both suites on pull requests and on pushes to `main`.

## Change the format

1. Edit `spec/content-format.md`. If the syntax or the validation rules change, bump `spec/VERSION` and `CONTENT_FORMAT_VERSION` in `packages/content-core/src/bookMeta.ts`. content-core's tests fail if the two differ.
2. Update the parser and validator in content-core, and the matching checks in `packages/ptsb-pack/ptsb_pack/validate.py`.
3. Bump the version of each package you changed.

## Release content-core

Bump `version` in `packages/content-core/package.json` and merge. Then push an annotated tag whose message is the release notes:

```bash
git tag -a content-core-v<version> -F notes.md && git push origin content-core-v<version>
```

The release workflow checks the tag against `package.json`, runs the tests and attaches `politost-content-core-<version>.tgz` to the release.

Tags `v0.1.0` to `v0.2.1` are content-core releases from before the merge into this repository.

## Release ptsb-pack

Bump `version` in `packages/ptsb-pack/pyproject.toml` and merge. Then push a `ptsb-pack-v<version>` tag. There is no release page for it, because pip installs straight from the tag.
