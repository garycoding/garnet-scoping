# Licensing

Copyright © 2026 Gary Frattarola.

## How this project is licensed

The code is licensed under `AGPL-3.0-or-later`. The full text is in [`LICENSE`](LICENSE) and [`LICENSES/`](LICENSES/).

## Per-bucket licensing

Different kinds of content carry different licenses (encoded in [`REUSE.toml`](REUSE.toml) and per-file SPDX headers):

| Bucket | License |
|---|---|
| Code, build scripts, configs, lockfiles, workflows | `AGPL-3.0-or-later` |
| Documentation (`docs/`, `README.md`, this file) | `CC-BY-4.0` |

## Third-party components in the app

The packaged app bundles its npm dependencies (listed, with their licences, in the app's Open Source Licenses window and in `legal/` at build time), among them Excalidraw (MIT) and React (MIT). The board carries Excalidraw's fonts, copied from its package at build time: Excalifont, Virgil, Assistant, Cascadia Code, Liberation, Lilita One, Nunito and Xiaolai under the SIL Open Font License 1.1, and Comic Shanns under the MIT licence.

## REUSE compliance

This repo is [REUSE](https://reuse.software/)-compliant. Every file has a license via an SPDX header or a `REUSE.toml` annotation. Verify with:

```bash
uvx --from "reuse[charset-normalizer]" reuse lint
```
