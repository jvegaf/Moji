// Moji Plus: DOM glue for the Vim link-navigation mode (Ctrl+M). It owns an index plus a CSS
// class over the preview anchors; it never steals DOM focus, so Tab order, focusAcceptsText()
// and native anchor activation stay untouched. See src/lib/plusLinkNav.ts and FORK.md.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clampLinkIndex,
  classifyPreviewHref,
  firstVisibleLinkIndex,
  halfPageDistance,
  LINK_FOCUS_CLASS,
  linkIndexForScroll,
  stepLinkIndex,
  type PreviewLinkBand,
  type PreviewLinkKind
} from '../lib/plusLinkNav'

const KEEP_VISIBLE_MARGIN = 24
const LINK_SELECTOR = '.markdown-body a[href]'

/**
 * T2 extension point: App can route markdown-document links to a new tab here. Without it every
 * activation is `anchor.click()`, so the existing preview delegation keeps owning anchors,
 * external URLs and non-markdown file targets.
 */
export type PreviewLinkActivate = (anchor: HTMLAnchorElement, kind: PreviewLinkKind) => void

interface Options {
  pane: HTMLDivElement | null
  enabled: boolean
  documentId: string | null
  html: string
  activateLink?: PreviewLinkActivate
}

interface State {
  active: boolean
  index: number
}

const IDLE: State = { active: false, index: -1 }

function collectLinks(pane: HTMLDivElement): HTMLAnchorElement[] {
  return Array.from(pane.querySelectorAll<HTMLAnchorElement>(LINK_SELECTOR))
}

/** Link boxes in the pane's own scroll coordinates, so geometry survives a scroll. */
function linkBands(pane: HTMLDivElement, links: readonly HTMLAnchorElement[]): PreviewLinkBand[] {
  const paneTop = pane.getBoundingClientRect().top
  return links.map((link) => {
    const rect = link.getBoundingClientRect()
    const top = rect.top - paneTop + pane.scrollTop
    return { top, bottom: top + rect.height }
  })
}

/** Minimum `scrollTop` correction that brings the link inside the pane with a small margin. */
function keepLinkVisible(pane: HTMLDivElement, link: HTMLAnchorElement): void {
  const paneTop = pane.getBoundingClientRect().top
  const rect = link.getBoundingClientRect()
  const top = rect.top - paneTop
  const bottom = rect.bottom - paneTop
  const limit = pane.clientHeight - KEEP_VISIBLE_MARGIN
  if (top < KEEP_VISIBLE_MARGIN) pane.scrollTop += top - KEEP_VISIBLE_MARGIN
  else if (bottom > limit) pane.scrollTop += bottom - limit
}

export function usePreviewLinkNav({ pane, enabled, documentId, html, activateLink }: Options) {
  const [state, setState] = useState<State>(IDLE)
  const stateRef = useRef<State>(IDLE)

  const setNav = useCallback((next: State): void => {
    stateRef.current = next
    setState(next)
  }, [])

  const focusIndex = useCallback(
    (links: readonly HTMLAnchorElement[], index: number): void => {
      const next = clampLinkIndex(index, links.length)
      if (next === -1 || !pane) {
        setNav(IDLE)
        return
      }
      setNav({ active: true, index: next })
      keepLinkVisible(pane, links[next])
    },
    [pane, setNav]
  )

  const toggle = useCallback((): void => {
    if (!enabled) return
    if (stateRef.current.active) {
      setNav(IDLE)
      return
    }
    if (!pane) return
    const links = collectLinks(pane)
    if (links.length === 0) return
    focusIndex(links, firstVisibleLinkIndex(linkBands(pane, links), pane.scrollTop))
  }, [enabled, focusIndex, pane, setNav])

  const move = useCallback(
    (delta: 1 | -1): void => {
      if (!stateRef.current.active || !pane) return
      const links = collectLinks(pane)
      focusIndex(links, stepLinkIndex(stateRef.current.index, links.length, delta))
    },
    [focusIndex, pane]
  )

  const first = useCallback((): void => {
    if (!stateRef.current.active || !pane) return
    focusIndex(collectLinks(pane), 0)
  }, [focusIndex, pane])

  const last = useCallback((): void => {
    if (!stateRef.current.active || !pane) return
    const links = collectLinks(pane)
    focusIndex(links, links.length - 1)
  }, [focusIndex, pane])

  const halfPage = useCallback(
    (direction: 'down' | 'up'): void => {
      if (!stateRef.current.active || !pane) return
      const links = collectLinks(pane)
      const half = halfPageDistance(pane.clientHeight)
      pane.scrollTop += direction === 'down' ? half : -half
      // A document that exposes no links (or lost them to a block swap) still gets the whole
      // half page, the same distance the mode-off path scrolls; the mode stays on with index -1,
      // so no ring is painted and a link reappearing later can take it.
      if (links.length === 0) {
        setNav({ active: true, index: -1 })
        return
      }
      const viewportTop = pane.scrollTop
      focusIndex(
        links,
        linkIndexForScroll({
          links: linkBands(pane, links),
          currentIndex: stateRef.current.index,
          viewportTop,
          viewportBottom: viewportTop + pane.clientHeight,
          direction
        })
      )
    },
    [focusIndex, pane, setNav]
  )

  const activate = useCallback((): void => {
    if (!stateRef.current.active || !pane) return
    const anchor = collectLinks(pane)[stateRef.current.index]
    if (!anchor) return
    if (activateLink) activateLink(anchor, classifyPreviewHref(anchor.getAttribute('href') ?? ''))
    else anchor.click()
  }, [activateLink, pane])

  // The setting, a document switch or a fresh preview body all end the mode.
  useEffect(() => {
    setNav(IDLE)
  }, [documentId, enabled, html, setNav])

  // The ring follows the index; cleanup also covers a pane being replaced.
  useEffect(() => {
    if (!pane) return
    const links = collectLinks(pane)
    links.forEach((link, index) => link.classList.toggle(LINK_FOCUS_CLASS, state.active && index === state.index))
    return () => {
      for (const link of links) link.classList.remove(LINK_FOCUS_CLASS)
    }
  }, [html, pane, state.active, state.index])

  return useMemo(
    () => ({ active: state.active, index: state.index, toggle, move, first, last, halfPage, activate }),
    [state.active, state.index, toggle, move, first, last, halfPage, activate]
  )
}
