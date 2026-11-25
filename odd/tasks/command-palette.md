# Command palette

Feature: paleta de comandos activada con Ctrl+P que permite buscar y ejecutar opciones de menú y settings.

## Specs

- S1: Pedido del usuario (verbatim): "hay que crear una nueva feature, la cual es un command pallete que se activara con el el shortcut ctrl p.\n\ndebe de tener un nuevo componente que aparecera de forma modal,  en la parte central superior (pero que no este pegado al borde topm, sino que tenga unos 200px de margen desde ese borde superior) de la main window. El componente debe de ser un un search box con selector en el cual van apareciendo los posibles resultados segun se va escribiendo, entre los que tienen que estar todas las opciones que tenemos en los menus, junto con las opciones que tenemos en los settings"
- S2: Activación: el shortcut `Ctrl+P` (y `Cmd+P` en macOS, siguiendo el patrón `primary` existente) abre/cierra la paleta. No hay binding existente para Ctrl+P.
- S3: UI: componente modal nuevo, centrado horizontalmente, en la parte superior central de la main window con ~200px de margen desde el borde superior (no pegado al top).
- S4: Interacción: search box con selector/lista; los resultados se filtran y aparecen según se va escribiendo. Navegación por teclado (↑/↓), `Enter` ejecuta, `Esc` cierra, click ejecuta. Ítems deshabilitados se muestran pero no se ejecutan.
- S5: Fuentes de resultados: incluye todas las opciones que tenemos en los menús, junto con las opciones que tenemos en los settings.
- S6: Comportamiento de settings (decisión usuario): "Aplicar directo" — los toggles cambian al instante; enums/valores muestran sus opciones o aplican el cambio directo.
- S7: Listado de settings con múltiples valores (decisión usuario): "Una por setting" — una entrada por setting; al elegirla se aplica la acción definida en S6 (toggle directo, o drill-in/subselección para enums/valores).

## Tasks

| ID | Specs | Route | Commit | Status | Notes |
|---|---|---|---|---|---|
| T1 | S1-S7 | inline |  | done | Modelo unificado en `src/lib/commandPalette.ts` (menú aplanado + settings S6/S7 con drill-in), `src/components/CommandPalette.tsx` (modal ~200px top, búsqueda, ↑/↓/Enter/Esc/click, disabled visible), wiring en `App.tsx` (Ctrl/Cmd+P toggle, estado, closeActivePanel, comandos), estilos en `plus-hig.css`, claves `plus.commandPalette.*` en 15 brand locales. Checks: `npm run typecheck` ok; `npm run verify` ok (typecheck + check-branding). |

## Log

- L1 (user request, verbatim): "hay que crear una nueva feature, la cual es un command pallete que se activara con el el shortcut ctrl p.\n\ndebe de tener un nuevo componente que aparecera de forma modal,  en la parte central superior (pero que no este pegado al borde topm, sino que tenga unos 200px de margen desde ese borde superior) de la main window. El componente debe de ser un un search box con selector en el cual van apareciendo los posibles resultados segun se va escribiendo, entre los que tienen que estar todas las opciones que tenemos en los menus, junto con las opciones que tenemos en los settings"
- L2 (decision): Al elegir un setting desde la paleta = "Aplicar directo" (toggles cambian al instante; enums/valores muestran sus opciones o aplican el cambio directo).
- L3 (decision): Settings con múltiples valores = "Una por setting" (un ítem por setting; al elegirlo se aplica la acción definida en L2).
- L4 (implementation): Implementado T1 (S1-S7). Añadido `src/lib/commandPalette.ts` (CommandPaletteCommand, flatten de menú con dedupe, comandos de settings con drill-in/toggle directo, filtro normalizado) y `src/components/CommandPalette.tsx` (modal centrado, margen superior 200px, búsqueda con autofocus, selector activo, ↑/↓/Enter/Esc/click, drill-in con back por Esc, disabled no ejecutable). `src/lib/plusMenu.ts` exporta snapshot `currentPlusMenu` y `usePlusMenu` devuelve menú. `src/App.tsx` añade estado `commandPaletteOpen`, toggle Ctrl/Cmd+P (primary, sin Shift), integración con `closeActivePanel`/panel guards, y render del modal. Estilos en `src/styles/plus-hig.css`. i18n: `plus.commandPalette.*` en los 15 `src/locales/brand/*.json`. Evidencia: `npm run typecheck` exit 0; `npm run verify` exit 0 (typecheck + check-branding: ok). Sin commit.
- L5 (fix post-review): Ajustado `src/lib/commandPalette.ts` para no omitir roles de menú sin ejecución renderer segura (minimize/zoom/hide/hideOthers/unhide/services); ahora se muestran deshabilitados para cumplir mejor S5. Evidencia: `npm run typecheck` exit 0.
- L6 (validation/release): Smoke manual aprobado por el usuario. Versión minor subida a 1.7.0 (package.json, package-lock.json, src/index.html, README, CHANGELOG, metainfo). Pendiente commit/tag/push según pedido del usuario.
