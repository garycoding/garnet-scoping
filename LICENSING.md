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
| The garnet-scoping icon (`build/icon.*`) | All rights reserved (`LicenseRef-AllRightsReserved`), not covered by the AGPL |

## The name and icon

The name garnet-scoping and its icon are used as trademarks of this project (unregistered). They identify the official project and its releases. The AGPL grants rights in the code, not in the name or the icon: a modified version may be distributed under the AGPL's terms, but under another name and with another icon, and must not suggest that it is the official garnet-scoping. Stating that a build is based on garnet-scoping is permitted. Unmodified releases may be redistributed with the name and icon.

## Third-party components in the app

The packaged app bundles its npm dependencies (listed, with their licences, in the app's Open Source Licenses window and in `legal/` at build time), among them Excalidraw (MIT) and React (MIT). The board carries Excalidraw's fonts, copied from its package at build time: Excalifont, Virgil, Assistant, Cascadia Code, Liberation, Lilita One, Nunito and Xiaolai under the SIL Open Font License 1.1, and Comic Shanns under the MIT licence.

## REUSE compliance

This repo is [REUSE](https://reuse.software/)-compliant. Every file has a license via an SPDX header or a `REUSE.toml` annotation. Verify with:

```bash
uvx --from "reuse[charset-normalizer]" reuse lint
```
