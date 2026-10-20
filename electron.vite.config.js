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

// The board keeps its full layout (tools, style panel and zoom in place) at
// any size. Excalidraw switches to a compact phone layout when its area is
// narrower than about 730 px, which a board on the left or right half of the
// window often is. Its breakpoint test is replaced by one that never reports
// a phone; the build fails if the test is not found, so that an Excalidraw
// update cannot silently bring the compact layout back.
const boardFullLayout = {
  name: 'board-full-layout',
  transform(code, id) {
    if (!id.includes('@excalidraw/excalidraw/dist/') || !code.includes('isMobileBreakpoint')) return null
    const marker = /(["']isMobileBreakpoint["'],\s*)/g
    const count = (code.match(marker) ?? []).length
    if (count !== 1) this.error(`board-full-layout: expected one isMobileBreakpoint definition in ${id}, found ${count}`)
    // The helper that defines the field takes three arguments; the original
    // function becomes an ignored fourth.
    return { code: code.replace(marker, '$1() => false, '), map: null }
  },
}

// Images keep their own colours. In its dark theme Excalidraw draws images
// through an inverting filter, to cancel the inversion of its whole canvas;
// the board turns that canvas inversion off (its own colours, in style.css),
// so the image filter is turned off too. The build fails if the filter is not
// found, so that an Excalidraw update cannot silently invert images again.
const IMAGE_INVERT = 'invert(100%) hue-rotate(180deg) saturate(1.25)'
let imageFilterFound = false
const boardImageColours = {
  name: 'board-image-colours',
  transform(code, id) {
    if (!id.includes('@excalidraw/excalidraw/dist/') || !code.includes(IMAGE_INVERT)) return null
    imageFilterFound = true
    return { code: code.split(IMAGE_INVERT).join('none'), map: null }
  },
  buildEnd() {
    if (!imageFilterFound) this.error(`board-image-colours: Excalidraw's image filter (${IMAGE_INVERT}) was not found`)
  },
}

export default defineConfig({
  main: { build: { externalizeDeps: false } },
  preload: { build: { externalizeDeps: false } },
  renderer: {
    plugins: [excalidrawFonts, boardFullLayout, boardImageColours],
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html'), session: resolve('src/renderer/session.html'), settings: resolve('src/renderer/settings.html') },
      },
    },
  },
})
