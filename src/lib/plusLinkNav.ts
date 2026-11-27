// Moji Plus: pure link-navigation logic for the Vim link mode (Ctrl+M). Framework-free so the
// ring movement and href classification can be checked with plain Node; the DOM glue lives in
// src/hooks/usePreviewLinkNav.ts. See FORK.md.

import { extensionOf, isMarkdownExtension } from '../../electron/plusDocumentTypes'

export type PreviewLinkKind = 'anchor' | 'external' | 'file' | 'markdown'

/** Class the hook paints on the ring's current link (src/hooks/usePreviewLinkNav.ts). */
export const LINK_FOCUS_CLASS = 'plus-link-nav-focus'

/** One half-page distance for every Vim half-page motion, in link mode and out of it. */
export function halfPageDistance(viewportHeight: number): number {
  return Math.max(40, Math.floor(viewportHeight / 2))
}

/** What a rendered preview anchor points at. The DOM href is already absolute for file links
 *  (src/lib/markdownCore.ts), so this sees the same URL the click delegation would. */
export function classifyPreviewHref(href: string): PreviewLinkKind {
  const value = href.trim()
  if (value.startsWith('#')) return 'anchor'
  if (/^(?:https?|mailto|tel):/i.test(value)) return 'external'
  if (!/^file:/i.test(value)) return 'file'

  return isMarkdownExtension(extensionOf(fileUrlPath(value))) ? 'markdown' : 'file'
}

function fileUrlPath(href: string): string {
  try {
    return decodeURIComponent(new URL(href).pathname)
  } catch {
    return href.replace(/^file:/i, '')
  }
}

export interface PreviewLinkBand {
  top: number
  bottom: number
}

/** Empty lists have no index; the -1 is the hook's "nothing focused" value. */
export function clampLinkIndex(index: number, count: number): number {
  if (count <= 0) return -1
  if (!Number.isFinite(index)) return 0
  return Math.min(count - 1, Math.max(0, Math.trunc(index)))
}

/** Vim j/k: one link at a time, clamped at both ends instead of wrapping. */
export function stepLinkIndex(current: number, count: number, delta: 1 | -1): number {
  if (count <= 0) return -1
  return clampLinkIndex(clampLinkIndex(current, count) + delta, count)
}

/** Entering the mode: the first link still at or below the viewport top, otherwise the first
 *  link of the document so a scrolled-past document is still reachable. */
export function firstVisibleLinkIndex(links: readonly PreviewLinkBand[], viewportTop: number): number {
  if (links.length === 0) return -1
  const index = links.findIndex((link) => link.bottom > viewportTop)
  return index === -1 ? 0 : index
}

/**
 * Ctrl+D / Ctrl+U: the link that lands in the new viewport, else the next available link in the
 * same direction, else the clamped end. Links are in document order.
 */
export function linkIndexForScroll(input: {
  links: readonly PreviewLinkBand[]
  currentIndex: number
  viewportTop: number
  viewportBottom: number
  direction: 'down' | 'up'
}): number {
  const { links, currentIndex, viewportTop, viewportBottom, direction } = input
  if (links.length === 0) return clampLinkIndex(currentIndex, links.length)

  const current = clampLinkIndex(currentIndex, links.length)
  const inBand = (link: PreviewLinkBand): boolean => link.bottom > viewportTop && link.top < viewportBottom

  if (direction === 'down') {
    // Never move the ring backwards while the page scrolls down: only a link at or after the
    // current index may take it, even when an earlier link still intersects the new viewport.
    for (let index = current; index < links.length; index += 1) {
      if (inBand(links[index])) return index
    }
    const below = links.findIndex((link) => link.top >= viewportBottom)
    return below !== -1 ? below : links.length - 1
  }

  // Mirrored for Ctrl+U: only a link at or before the current index may take the ring.
  for (let index = current; index >= 0; index -= 1) {
    if (inBand(links[index])) return index
  }
  for (let index = links.length - 1; index >= 0; index -= 1) {
    if (links[index].bottom <= viewportTop) return index
  }
  return 0
}
