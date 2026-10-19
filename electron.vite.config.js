// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'electron-vite'

// Every process is bundled with its dependencies (only Electron and Node's
// built-ins stay external), so the package needs no node_modules at run time.
export default defineConfig({
  main: { build: { externalizeDeps: false } },
  preload: { build: { externalizeDeps: false } },
  renderer: {},
})
