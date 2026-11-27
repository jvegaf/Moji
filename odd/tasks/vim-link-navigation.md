# Vim link navigation mode (Ctrl+M)

Feature: a third Vim sub-mode inside the preview that moves a focus ring across the document links
and activates them. Extends the existing Vim navigation feature (`odd/tasks/vim-navigation.md`).

## Specs

S1. `vamos a mejorar el vim-mode, de tal manera de que con el atajo ctrl-m tengamos el modo de navegacion entre enlaces.`

S2. `con ese modo tendremos la posibilidad de tener el foco sobre un enlace del documento, teniendo la posibilidad de mover ese foco con j/k.`

S3. `cuando el usuario pulse Return, en caso de que sea un enlace a otro documento markdown, debemos de abrir ese documento en una nueva pestana. Para los demas casos de enlaces delegamos en xdg, etc....`

S4. `tenemos que ser coherentes mientras estamos en el modo de navegacion entre enlaces con los motions gg/G ctrl d/u para mover el foco de los enlaces tambien. por ejemplo. con gg movemos el foco al primer enlace que haya. con ctrl d, avanzamos media pagina y en caso de no existir enlaces en ese trozo, nos dirigimos al siguiente enlace disponible...`

S5. `para desactivar el modo de navegacion entre enlaces es volviendo a pulsar ctrl-m.`

## Constraints (derived from the repository, not user requirements)

- Gated by the existing `settings.vimNavigation` switch and by the existing vim key handler gate
  (`src/App.tsx`, `vimNavigation && !focusAcceptsText() && no [role="dialog"]`). No key is stolen while
  text is focused.
- Preview click behaviour, anchor scrolling, editor behaviour, export and the existing vim motions stay
  unchanged. Non-link vim motions keep working when link mode is off.
- No test harness: `.ai-framework/RULES.md` forbids reintroducing one without an explicit request, so
  verification is `npm run typecheck`, `npm run verify`, a bounded deterministic check of the pure
  functions (throwaway script outside the repo, no new dependency) plus a manual GUI smoke.
- Fork conventions apply (`.ai-framework/FORK.md`): upstream files change minimally, fork behaviour is
  documented in FORK.md, brand-facing strings live in `src/locales/brand/*.json` (all 15 files).

## Tasks

| ID | Specs | Route | Commit |
| --- | --- | --- | --- |
| T1 Core link-navigation mode: pure logic `src/lib/plusLinkNav.ts`, DOM glue `src/hooks/usePreviewLinkNav.ts`, App wiring for Ctrl+M / j / k / gg / G / Ctrl+D / Ctrl+U / Return, focus-ring style | S1, S2, S4, S5 | gentle-ai-worker | 5d698d3 |
| T2 Markdown-document links open in a new tab (main-process path authorization + preload + renderer) | S3 | gentle-ai-worker | f612c1c |
| T3 Discoverability: vim shortcut table, 15 brand locale overlays, FORK.md, README, CHANGELOG | S1-S5 | gentle-ai-worker | C3 (the commit that carries this table) |

## Log

L1. User request, verbatim:

```
vamos a mejorar el vim-mode, de tal manera de que con el atajo ctrl-m tengamos el modo de navegacion entre enlaces. 
con ese modo tendremos la posibilidad de tener el foco sobre un enlace del documento, teniendo la posibilidad de mover ese foco con j/k. 
cuando el usuario pulse Return, en caso de que sea un enlace a otro documento markdown, debemos de abrir ese documento en una nueva pestana. 
Para los demas casos de enlaces delegamos en xdg, etc.... 

tenemos que ser coherentes mientras estamos en el modo de navegacion entre enlaces con los motions gg/G ctrl d/u para mover el foco de los enlaces tambien.
por ejemplo. con gg movemos el foco al primer enlace que haya. con ctrl d, avanzamos media pagina y en caso de no existir enlaces en ese trozo, nos dirigimos al siguiente enlace disponible...

para desactivar el modo de navegacion entre enlaces es volviendo a pulsar ctrl-m.
```

L2. Evidence map (explorer, read-only): vim keys are handled in one `window` keydown effect in
`src/App.tsx` (~2217-2510) with a `vimPendingGRef` boolean for `g`-sequences; the preview pane element
comes from `previewPaneRef`. Preview links are already rewritten at render time by
`src/lib/markdownCore.ts:211-225`: `#anchor` becomes `#user-content-…`, relative/absolute paths become
absolute `file:` URLs, and other schemes pass through. Click delegation lives in
`src/components/Preview.tsx:359-390` (anchor scroll, `file:` → `onOpenLocalPath` → xdg; http(s) rely on
`target="_blank"` + `setWindowOpenHandler` → `shell.openExternal`). New tabs use `openPaths` in
`src/App.tsx:1339-1362` → `IPC.readPathStream`; `electron/fileCapabilities.ts` authorizes reads, so a
sibling document needs an explicit grant in main. There is no renderer path helper and no exported
`fileUrlToPath`.

L3. Decisions taken by the coordinator from L2:
- Activation reuses existing delegation: anchor, external URL and non-markdown `file:` targets are
  activated with `anchor.click()`, so the current scroll/`openExternal`/`xdg` paths keep owning them.
  Only markdown documents take the new tab route.
- "Focus" is a visual ring plus an index, never a DOM focus steal: it keeps Tab order, `focusAcceptsText`
  and native anchor activation untouched.
- Path authorization stays in main behind one new IPC: a document link can only be opened in a tab when
  `fileCapabilities` resolves it against an already granted directory; otherwise the activation falls
  back to the existing OS delegation.

L4. Implementation and verification of T1-T3:
- T1 (`5d698d3`): `linkIndexForScroll` selects the band link monotonically with the scroll direction
  (an earlier link still in the band can no longer pull the ring backwards); the Vim keydown handler
  reads the mode through `linkNavRef`, so the global listener is not re-created on every ring move.
- T2 (`f612c1c`): channel `plus:open-linked-document`; `linkedDocumentPath` claims, `resolveLinkedPath`
  authorizes, `grantDocument` records the single authorized file. Verified independently: `/etc/passwd`,
  `..`, `%2e%2e`, symlinks out of the opened tree, foreign hosts, directories, NUL bytes and non-Markdown
  extensions are all refused before any grant, and the grant set never leaves the already opened tree.
- T3 (this commit): shortcut rows `vimLinkMode` / `vimLinkActivate`, 15 brand overlays, FORK.md,
  README, CHANGELOG.
- Independent verifier also required the Enter guard: `Return` only activates while the preview pane (or
  nothing) owns the keyboard, so the Vim help sheet and focused controls keep their own Enter. Fixed
  before the commits above.
- Known limitation (advisory, not a spec): in the virtualized preview (`very-large` size profile) only
  mounted blocks expose links, so `gg`/`G` reach the first/last mounted link and the ring index can drift
  after a block swap. Normal documents are unaffected.
- Checks: `npm run typecheck` and `npm run verify` green on every unit; deterministic ad-hoc checks of
  `plusLinkNav` and `linkedDocumentPath` were run outside the repository (RED observed first, then
  GREEN); no test harness added, per `.ai-framework/RULES.md`. Manual GUI smoke is the user's.
