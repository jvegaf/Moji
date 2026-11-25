// Moji Plus: command palette model and helpers (see odd/tasks/command-palette.md).
import type { TFunction } from 'i18next'
import type { PlusMenuItem } from '../../electron/plusMenu'
import {
  PREVIEW_WIDTH_MAX,
  PREVIEW_WIDTH_MIN,
  PREVIEW_WIDTH_STEP,
  type Language,
  type Settings,
  type ThemePreference
} from '../../electron/shared'
import { runPlusMenuCommand } from './plusMenu'

export type CommandPaletteKind = 'menu' | 'setting'

export interface CommandPaletteCommand {
  id: string
  label: string
  category: string
  /** Extra searchable text (category, keywords). */
  searchText: string
  enabled: boolean
  shortcut?: string
  kind: CommandPaletteKind
  detail?: string
  /** Executes the command. Returns true when palette should close. */
  run?: () => boolean | void
  /** Drill-in children (S6/S7). */
  children?: CommandPaletteCommand[]
}

export interface CommandPaletteBuildOptions {
  menu: PlusMenuItem[]
  settings: Settings
  t: TFunction
  /** Current menu/action state for enabled checks and labels. */
  state: {
    hasDoc: boolean
    canAdjustFontSize: boolean
  }
  actions: {
    changeSettings: (patch: Partial<Settings>) => void
  }
}

const SETTING_IDS = new Set([
  'setting:appearance',
  'setting:language',
  'setting:autoSave',
  'setting:reopenFiles',
  'setting:alwaysShowTabs',
  'setting:vimNavigation',
  'setting:previewFontFamily',
  'setting:previewFontSize',
  'setting:editorFontSize',
  'setting:previewLineHeight',
  'setting:previewWidth',
  'setting:splitView',
  'setting:outlineVisible',
  'setting:previewFluidWidth'
])

/** Menu ids covered by setting commands; avoid duplicates in results. */
const MENU_IDS_AS_SETTINGS = new Set([
  'appearance:system',
  'appearance:light',
  'appearance:dark',
  'toggleSplit',
  'toggleOutline',
  'toggleFluidWidth'
])

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function filterCommands(commands: CommandPaletteCommand[], query: string): CommandPaletteCommand[] {
  const q = normalize(query.trim())
  if (!q) return commands
  const terms = q.split(/\s+/).filter(Boolean)
  return commands.filter((cmd) => {
    const hay = normalize(`${cmd.label} ${cmd.category} ${cmd.searchText} ${cmd.detail ?? ''}`)
    return terms.every((term) => hay.includes(term))
  })
}

function flattenMenu(
  items: PlusMenuItem[],
  category: string,
  t: TFunction,
  out: CommandPaletteCommand[],
  seen: Set<string>
): void {
  for (const item of items) {
    if ('type' in item && item.type === 'separator') continue
    const label = item.label?.trim()
    if (!label) continue
    const submenu = 'submenu' in item ? item.submenu : undefined
    const id = 'id' in item ? item.id : undefined
    const role = 'role' in item ? item.role : undefined
    const enabled = item.enabled !== false
    const shortcut = 'accelerator' in item ? item.accelerator : undefined

    // Container submenu without an own command: recurse with its label as category.
    if (submenu && !id && !role) {
      flattenMenu(submenu, label, t, out, seen)
      continue
    }

    // Submenu with children and no direct action: include children; if it also has an id, include it.
    if (submenu) {
      if (id && !seen.has(id) && !MENU_IDS_AS_SETTINGS.has(id)) {
        seen.add(id)
        out.push(menuCommand({ id, label, category, enabled, shortcut, role }))
      }
      flattenMenu(submenu, label, t, out, seen)
      continue
    }

    if (id) {
      if (seen.has(id) || MENU_IDS_AS_SETTINGS.has(id)) continue
      seen.add(id)
      out.push(menuCommand({ id, label, category, enabled, shortcut, role }))
      continue
    }

    if (role) {
      const roleId = `role:${role}`
      if (seen.has(roleId)) continue
      seen.add(roleId)
      const cmd = roleCommand(role, label, category, enabled, shortcut)
      if (cmd) out.push(cmd)
    }
  }
}

function menuCommand(opts: {
  id: string
  label: string
  category: string
  enabled: boolean
  shortcut?: string
  role?: string
}): CommandPaletteCommand {
  return {
    id: opts.id,
    label: opts.label,
    category: opts.category,
    searchText: opts.role ? opts.role : '',
    enabled: opts.enabled,
    shortcut: opts.shortcut,
    kind: 'menu',
    run: () => {
      if (!opts.enabled) return false
      runPlusMenuCommand(opts.id)
      return true
    }
  }
}

function roleCommand(
  role: string,
  label: string,
  category: string,
  enabled: boolean,
  shortcut: string | undefined
): CommandPaletteCommand | null {
  const run = roleRunner(role)
  if (!run) {
    // S5: keep menu role items visible even when there is no safe renderer-side execution path.
    return {
      id: `role:${role}`,
      label,
      category,
      searchText: role,
      enabled: false,
      shortcut,
      kind: 'menu'
    }
  }
  return {
    id: `role:${role}`,
    label,
    category,
    searchText: role,
    enabled,
    shortcut,
    kind: 'menu',
    run: () => {
      if (!enabled) return false
      run()
      return true
    }
  }
}

function roleRunner(role: string): (() => void) | null {
  switch (role) {
    case 'undo':
    case 'redo':
    case 'cut':
    case 'copy':
    case 'paste':
    case 'delete':
      return () => document.execCommand(role)
    case 'pasteAndMatchStyle':
      return () => {
        // Best-effort: paste as plain text in editable targets.
        navigator.clipboard?.readText().then((text) => {
          document.execCommand('insertText', false, text)
        }).catch(() => document.execCommand('paste'))
      }
    case 'selectAll':
      return () => document.execCommand('selectAll')
    case 'startSpeaking': {
      return () => {
        const text = window.getSelection()?.toString()
        if (text && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
        }
      }
    }
    case 'stopSpeaking':
      return () => {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      }
    case 'togglefullscreen':
      return () => {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen()
      }
    case 'front':
      return () => { window.focus() }
    default:
      return null
  }
}

const PREVIEW_FONT_SIZES = [12, 14, 16, 18, 20, 24]
const EDITOR_FONT_SIZES = [12, 13, 14, 16, 18, 20]
const LINE_HEIGHTS = [1.4, 1.5, 1.6, 1.7, 1.8, 2.0]
const FONT_FAMILIES = ['Inter', 'system-ui', 'serif', 'monospace']

function languageLabel(code: Language): string {
  const names: Partial<Record<Language, string>> = {
    en: 'English',
    'en-GB': 'English (UK)',
    'pt-BR': 'Português (Brasil)',
    'pt-PT': 'Português (Portugal)',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    nl: 'Nederlands',
    ar: 'العربية',
    hi: 'हिन्दी',
    ja: '日本語',
    zh: '简体中文',
    'zh-TW': '繁體中文',
    ru: 'Русский'
  }
  return names[code] ?? code
}

function settingCategory(t: TFunction): string {
  return t('plus.commandPalette.settingsCategory', 'Settings')
}

function buildSettingCommands(options: CommandPaletteBuildOptions): CommandPaletteCommand[] {
  const { settings, t, state, actions } = options
  const cat = settingCategory(t)
  const cmds: CommandPaletteCommand[] = []

  const add = (cmd: CommandPaletteCommand): void => { cmds.push(cmd) }

  add({
    id: 'setting:appearance',
    label: t('settingsDialog.theme', 'Theme'),
    category: cat,
    searchText: 'appearance theme dark light system',
    enabled: true,
    kind: 'setting',
    detail: t(`settingsDialog.themeOptions.${settings.appearance}`, settings.appearance),
    children: (['system', 'light', 'dark'] as ThemePreference[]).map((value) => ({
      id: `setting:appearance:${value}`,
      label: t(`settingsDialog.themeOptions.${value}`, value),
      category: cat,
      searchText: value,
      enabled: true,
      kind: 'setting' as const,
      detail: settings.appearance === value ? t('plus.commandPalette.current', 'Current') : undefined,
      run: () => {
        actions.changeSettings({ appearance: value })
        return true
      }
    }))
  })

  add({
    id: 'setting:language',
    label: t('toolbar.language', 'Language'),
    category: cat,
    searchText: 'language locale',
    enabled: true,
    kind: 'setting',
    detail: languageLabel(settings.language),
    children: (['en', 'en-GB', 'pt-BR', 'pt-PT', 'es', 'fr', 'de', 'it', 'nl', 'ar', 'hi', 'ja', 'zh', 'zh-TW', 'ru'] as Language[]).map((value) => ({
      id: `setting:language:${value}`,
      label: languageLabel(value),
      category: cat,
      searchText: value,
      enabled: true,
      kind: 'setting' as const,
      detail: settings.language === value ? t('plus.commandPalette.current', 'Current') : undefined,
      run: () => {
        actions.changeSettings({ language: value })
        return true
      }
    }))
  })

  const boolSetting = (
    id: string,
    label: string,
    key: 'autoSave' | 'reopenFiles' | 'alwaysShowTabs' | 'vimNavigation' | 'splitView' | 'outlineVisible' | 'previewFluidWidth',
    searchText: string,
    enabled = true
  ): void => {
    const on = settings[key]
    add({
      id: `setting:${id}`,
      label,
      category: cat,
      searchText,
      enabled,
      kind: 'setting',
      detail: on ? t('plus.commandPalette.on', 'On') : t('plus.commandPalette.off', 'Off'),
      run: () => {
        actions.changeSettings({ [key]: !on } as Partial<Settings>)
        return true
      }
    })
  }

  boolSetting('autoSave', t('settingsDialog.autoSave', 'Keep new documents and unsaved changes between sessions'), 'autoSave', 'autosave drafts recovery')
  boolSetting('reopenFiles', t('settingsDialog.reopenFiles', 'Reopen open files on startup'), 'reopenFiles', 'reopen startup session')
  boolSetting('alwaysShowTabs', t('settingsDialog.alwaysShowTabs', 'Always show the tab bar'), 'alwaysShowTabs', 'tabs bar always')
  boolSetting('vimNavigation', t('settingsDialog.vimNavigation', 'Vim-style keyboard navigation'), 'vimNavigation', 'vim keyboard navigation')
  boolSetting('splitView', t('plus.menu.livePreview', 'Live Preview'), 'splitView', 'split live preview editor', state.hasDoc)
  boolSetting('outlineVisible', t('plus.menu.showSidebar', 'Show Outline'), 'outlineVisible', 'outline sidebar toc', state.hasDoc)
  boolSetting('previewFluidWidth', t('plus.menu.fullWidth', 'Full Reading Width'), 'previewFluidWidth', 'full width fluid reading', state.hasDoc)

  add({
    id: 'setting:previewFontFamily',
    label: t('settingsDialog.fontFamily', 'Font family'),
    category: cat,
    searchText: 'font family preview',
    enabled: true,
    kind: 'setting',
    detail: settings.previewFontFamily,
    children: FONT_FAMILIES.map((value) => ({
      id: `setting:previewFontFamily:${value}`,
      label: value,
      category: cat,
      searchText: value,
      enabled: true,
      kind: 'setting' as const,
      detail: settings.previewFontFamily === value ? t('plus.commandPalette.current', 'Current') : undefined,
      run: () => {
        actions.changeSettings({ previewFontFamily: value })
        return true
      }
    }))
  })

  add({
    id: 'setting:previewFontSize',
    label: t('plus.commandPalette.previewFontSize', 'Preview font size'),
    category: cat,
    searchText: 'preview font size zoom',
    enabled: state.canAdjustFontSize,
    kind: 'setting',
    detail: `${settings.previewFontSize}px`,
    children: PREVIEW_FONT_SIZES.map((value) => ({
      id: `setting:previewFontSize:${value}`,
      label: `${value}px`,
      category: cat,
      searchText: String(value),
      enabled: true,
      kind: 'setting' as const,
      detail: settings.previewFontSize === value ? t('plus.commandPalette.current', 'Current') : undefined,
      run: () => {
        actions.changeSettings({ previewFontSize: value })
        return true
      }
    }))
  })

  add({
    id: 'setting:editorFontSize',
    label: t('plus.commandPalette.editorFontSize', 'Editor font size'),
    category: cat,
    searchText: 'editor font size',
    enabled: state.canAdjustFontSize,
    kind: 'setting',
    detail: `${settings.editorFontSize}px`,
    children: EDITOR_FONT_SIZES.map((value) => ({
      id: `setting:editorFontSize:${value}`,
      label: `${value}px`,
      category: cat,
      searchText: String(value),
      enabled: true,
      kind: 'setting' as const,
      detail: settings.editorFontSize === value ? t('plus.commandPalette.current', 'Current') : undefined,
      run: () => {
        actions.changeSettings({ editorFontSize: value })
        return true
      }
    }))
  })

  add({
    id: 'setting:previewLineHeight',
    label: t('settingsDialog.lineHeight', 'Line height'),
    category: cat,
    searchText: 'line height preview',
    enabled: true,
    kind: 'setting',
    detail: String(settings.previewLineHeight),
    children: LINE_HEIGHTS.map((value) => ({
      id: `setting:previewLineHeight:${value}`,
      label: String(value),
      category: cat,
      searchText: String(value),
      enabled: true,
      kind: 'setting' as const,
      detail: settings.previewLineHeight === value ? t('plus.commandPalette.current', 'Current') : undefined,
      run: () => {
        actions.changeSettings({ previewLineHeight: value })
        return true
      }
    }))
  })

  const widths: number[] = []
  for (let w = PREVIEW_WIDTH_MIN; w <= PREVIEW_WIDTH_MAX; w += PREVIEW_WIDTH_STEP) widths.push(w)
  add({
    id: 'setting:previewWidth',
    label: t('settingsDialog.previewWidth', 'Preview width'),
    category: cat,
    searchText: 'preview width reading column',
    enabled: true,
    kind: 'setting',
    detail: `${settings.previewWidth}%`,
    children: widths.map((value) => ({
      id: `setting:previewWidth:${value}`,
      label: `${value}%`,
      category: cat,
      searchText: String(value),
      enabled: true,
      kind: 'setting' as const,
      detail: settings.previewWidth === value ? t('plus.commandPalette.current', 'Current') : undefined,
      run: () => {
        actions.changeSettings({ previewWidth: value })
        return true
      }
    }))
  })

  return cmds
}

export function buildCommandPaletteCommands(options: CommandPaletteBuildOptions): CommandPaletteCommand[] {
  const menuCommands: CommandPaletteCommand[] = []
  const seen = new Set<string>()
  for (const top of options.menu) {
    if ('type' in top && top.type === 'separator') continue
    const label = top.label?.trim()
    if (!label) continue
    const submenu = 'submenu' in top ? top.submenu : undefined
    if (submenu) flattenMenu(submenu, label, options.t, menuCommands, seen)
  }

  const settingsCommands = buildSettingCommands(options)
  // Dedupe: if a setting command covers the same concept as menu entries, we already filtered menu ids.
  // Also avoid duplicate setting ids.
  const settingSeen = new Set<string>()
  const dedupedSettings = settingsCommands.filter((cmd) => {
    if (settingSeen.has(cmd.id)) return false
    settingSeen.add(cmd.id)
    return SETTING_IDS.has(cmd.id) || cmd.id.startsWith('setting:')
  })

  return [...menuCommands, ...dedupedSettings]
}
