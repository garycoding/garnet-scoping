// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolve } from 'node:path'
import { cpSync } from 'node:fs'
import { defineConfig } from 'electron-vite'

// Every process is bundled with its dependencies (only Electron and Node's
// built-ins stay external), so the package needs no node_modules at run time.
// The renderer has three pages: the session list, the session window and Settings.
// Excalidraw's fonts are copied beside them, so the board loads them from the
// app and not from a network (R5.4).
const excalidrawFonts = {
  name: 'excalidraw-fonts',
  writeBundle(options) {
    cpSync(resolve('node_modules/@excalidraw/excalidraw/dist/prod/fonts'), resolve(options.dir, 'fonts'), { recursive: true })
  },
}

export default defineConfig({
  main: { build: { externalizeDeps: false } },
  preload: { build: { externalizeDeps: false } },
  renderer: {
    plugins: [excalidrawFonts],
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html'), session: resolve('src/renderer/session.html'), settings: resolve('src/renderer/settings.html') },
      },
    },
  },
})
