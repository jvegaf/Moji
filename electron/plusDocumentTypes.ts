// Moji Plus: the file types the app opens besides `.md`/`.markdown` (see FORK.md). Markdown
// variants render as Markdown; plain text is shown exactly as written. Shared by the main
// process (open/save gates, dialogs) and the renderer and Markdown worker, so no Node imports.

export const PLUS_MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.markdn', '.mdx'] as const
export const PLUS_PLAIN_TEXT_EXTENSIONS = ['.txt'] as const

const DOCUMENT_EXTENSIONS: readonly string[] = [...PLUS_MARKDOWN_EXTENSIONS, ...PLUS_PLAIN_TEXT_EXTENSIONS]
const PLAIN_TEXT_EXTENSIONS: readonly string[] = PLUS_PLAIN_TEXT_EXTENSIONS

/** Lowercase extension with its dot, or '' (a dotfile such as `.md` has none, as in `path.extname`). */
function extensionOf(filePath: string): string {
  const match = /[^\\/.][^\\/]*?(\.[^.\\/]+)$/.exec(filePath)
  return match ? match[1].toLowerCase() : ''
}

function isMarkdownExtension(extension: string): boolean {
  return (PLUS_MARKDOWN_EXTENSIONS as readonly string[]).includes(extension)
}

export function isPlusDocumentExtension(extension: string): boolean {
  return DOCUMENT_EXTENSIONS.includes(extension.toLowerCase())
}

export function hasPlusDocumentExtension(filePath: string): boolean {
  return isPlusDocumentExtension(extensionOf(filePath))
}

export function isPlainTextPath(filePath: string | null | undefined): boolean {
  return typeof filePath === 'string' && PLAIN_TEXT_EXTENSIONS.includes(extensionOf(filePath))
}

/**
 * Moji Plus: the Markdown document a preview link points at, or `null` when it is not one.
 *
 * Rendered hrefs come from document content, so this is untrusted input: it only recognises an
 * absolute local `file:` URL whose path names a Markdown file, never a directory, never a NUL
 * byte, and never another scheme. What it returns is a claim, not permission — the main process
 * still has to resolve it against the directories the user actually opened (see FORK.md).
 */
export function linkedDocumentPath(href: string): string | null {
  if (typeof href !== 'string') return null
  const value = href.trim()
  if (!/^file:/i.test(value) || value.includes('\0')) return null

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  // `file://host/...` names another machine's file; only a local one can be opened here.
  if (url.protocol !== 'file:') return null
  if (url.hostname !== '' && url.hostname.toLowerCase() !== 'localhost') return null

  let filePath: string
  try {
    filePath = decodeURIComponent(url.pathname)
  } catch {
    return null
  }
  if (filePath.includes('\0')) return null
  // Windows file URLs carry the drive as `/C:/…`; everything else here speaks plain paths.
  if (/^\/[A-Za-z]:[\\/]/.test(filePath)) filePath = filePath.slice(1)
  if (!filePath.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(filePath)) return null
  if (filePath.endsWith('/') || filePath.endsWith('\\')) return null
  return isMarkdownExtension(extensionOf(filePath)) ? filePath : null
}

interface FileFilter {
  name: string
  extensions: string[]
}

function withoutDot(extensions: readonly string[]): string[] {
  return extensions.map((extension) => extension.slice(1))
}

/** Open dialog: everything supported first, so Windows and Linux list all of it by default. */
export function plusOpenDialogFilters(): FileFilter[] {
  return [
    { name: 'Markdown & Text', extensions: withoutDot(DOCUMENT_EXTENSIONS) },
    { name: 'Markdown', extensions: withoutDot(PLUS_MARKDOWN_EXTENSIONS) },
    { name: 'Text', extensions: withoutDot(PLUS_PLAIN_TEXT_EXTENSIONS) }
  ]
}

/** Save dialog: the suggested name's own type first, so a `.txt` stays a `.txt`. */
export function plusSaveDialogFilters(suggestedName: string): FileFilter[] {
  const markdown = { name: 'Markdown', extensions: withoutDot(PLUS_MARKDOWN_EXTENSIONS) }
  const text = { name: 'Text', extensions: withoutDot(PLUS_PLAIN_TEXT_EXTENSIONS) }
  return isPlainTextPath(suggestedName) ? [text, markdown] : [markdown, text]
}
