import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { filterCommands, type CommandPaletteCommand } from '../lib/commandPalette'

interface CommandPaletteProps {
  commands: CommandPaletteCommand[]
  onClose: () => void
}

function findCommands(commands: CommandPaletteCommand[], path: string[]): { title?: string; commands: CommandPaletteCommand[] } {
  let current: CommandPaletteCommand[] = commands
  let title: string | undefined
  for (const id of path) {
    const found = current.find((cmd) => cmd.id === id)
    if (!found?.children) return { commands }
    title = found.label
    current = found.children
  }
  return { title, commands: current }
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps): JSX.Element {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [path, setPath] = useState<string[]>([])

  const level = useMemo(() => findCommands(commands, path), [commands, path])
  const filtered = useMemo(() => filterCommands(level.commands, query), [level.commands, query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, path])

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(filtered.length > 0 ? filtered.length - 1 : 0)
  }, [activeIndex, filtered.length])

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, filtered.length])

  const closeOrBack = (): void => {
    if (path.length > 0) {
      setPath((prev) => prev.slice(0, -1))
      setQuery('')
      inputRef.current?.focus()
      return
    }
    onClose()
  }

  const runCommand = (cmd: CommandPaletteCommand): void => {
    if (!cmd.enabled) return
    if (cmd.children && cmd.children.length > 0) {
      setPath((prev) => [...prev, cmd.id])
      setQuery('')
      inputRef.current?.focus()
      return
    }
    const shouldClose = cmd.run ? cmd.run() !== false : true
    if (shouldClose) onClose()
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (filtered.length === 0) return
      setActiveIndex((i) => (i + 1) % filtered.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (filtered.length === 0) return
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const cmd = filtered[activeIndex]
      if (cmd) runCommand(cmd)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeOrBack()
    }
  }

  return (
    <div
      className="plus-command-palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className="plus-command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t('plus.commandPalette.label', 'Command palette')}
        onKeyDown={onKeyDown}
      >
        <div className="plus-command-palette__search">
          {level.title && <span className="plus-command-palette__scope">{level.title}</span>}
          <input
            ref={inputRef}
            className="plus-command-palette__input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={level.title ? t('plus.commandPalette.filterPlaceholder', 'Filter options…') : t('plus.commandPalette.placeholder', 'Type a command…')}
            aria-label={t('plus.commandPalette.placeholder', 'Type a command…')}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="plus-command-palette__list" ref={listRef} role="listbox">
          {filtered.length === 0 ? (
            <div className="plus-command-palette__empty">{t('plus.commandPalette.empty', 'No results')}</div>
          ) : (
            filtered.map((cmd, index) => {
              const active = index === activeIndex
              return (
                <button
                  key={cmd.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  aria-disabled={!cmd.enabled}
                  data-active={active ? 'true' : 'false'}
                  className={`plus-command-palette__item ${active ? 'plus-command-palette__item--active' : ''} ${!cmd.enabled ? 'plus-command-palette__item--disabled' : ''}`}
                  onMouseEnter={() => { if (cmd.enabled) setActiveIndex(index) }}
                  onClick={() => runCommand(cmd)}
                >
                  <span className="plus-command-palette__item-main">
                    <span className="plus-command-palette__item-label">{cmd.label}</span>
                    <span className="plus-command-palette__item-category">{cmd.category}</span>
                  </span>
                  {(cmd.detail || cmd.shortcut || (cmd.children && cmd.children.length > 0)) && (
                    <span className="plus-command-palette__item-meta">
                      {cmd.detail && <span className="plus-command-palette__item-detail">{cmd.detail}</span>}
                      {cmd.shortcut && <span className="plus-command-palette__item-shortcut">{cmd.shortcut}</span>}
                      {cmd.children && cmd.children.length > 0 && <span className="plus-command-palette__item-arrow" aria-hidden="true">›</span>}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
