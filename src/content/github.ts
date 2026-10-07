/**
 * Knowledge about github.com's file editor page. Kept in one place because
 * GitHub's markup changes over time; selectors prefer stable attributes
 * (aria-label, data-testid) and fall back to structure and text.
 */

const MARKDOWN_FILE = /\.(md|markdown|mdown|mkdn|mkd)$/i

export interface EditRoute {
  owner: string
  repo: string
  kind: 'edit' | 'new'
  /** Everything after /edit/ or /new/: "<ref>/<path>" (ref may contain slashes). */
  rest: string
}

export function parseRoute(pathname: string): EditRoute | null {
  const m = /^\/([^/]+)\/([^/]+)\/(edit|new)\/(.+)$/.exec(pathname)
  if (!m) return null
  return { owner: m[1], repo: m[2], kind: m[3] as 'edit' | 'new', rest: decodeURIComponent(m[4]) }
}

/** Name of the file being edited, from the URL or the new-file name field. */
export function currentFileName(route: EditRoute): string {
  if (route.kind === 'edit') return route.rest.split('/').pop() ?? ''
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="File name"], input[placeholder="Name your file..."]',
  )
  return input?.value ?? ''
}

export function isMarkdownFile(name: string): boolean {
  return MARKDOWN_FILE.test(name)
}

/** The Edit / Preview segmented control above the source editor. */
export function findModeControl(): HTMLUListElement | null {
  const labelled = document.querySelector<HTMLUListElement>('ul[aria-label="Edit mode"]')
  if (labelled) return labelled
  for (const ul of document.querySelectorAll<HTMLUListElement>('ul')) {
    const texts = [...ul.querySelectorAll('li > button')].map((b) => b.textContent?.trim())
    if (texts.includes('Edit') && texts.includes('Preview')) return ul
  }
  return null
}

export function findModeButton(control: HTMLElement, text: 'Edit' | 'Preview'): HTMLButtonElement | null {
  for (const b of control.querySelectorAll<HTMLButtonElement>('li > button')) {
    if (b.textContent?.trim() === text) return b
  }
  return null
}

export function findSourceEditor(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('.cm-editor[data-testid="codemirror-editor"]') ??
    document.querySelector<HTMLElement>('.cm-editor')
  )
}

/**
 * The element that wraps the source editor (and its file-drop area), which
 * rich mode hides and replaces.
 */
export function findSourceHost(editor: HTMLElement): HTMLElement {
  return (
    editor.closest<HTMLElement>('[class*="codeViewEdit"]') ??
    editor.closest<HTMLElement>('[class*="FileUpload"]') ??
    editor
  )
}

interface EmbeddedRefInfo {
  ref: string
  path: string
}

/** Branch/ref and path from the page's embedded React data (hard loads only). */
export function readEmbeddedRefInfo(): EmbeddedRefInfo | null {
  try {
    const el = document.querySelector('script[data-target="react-app.embeddedData"]')
    const data = JSON.parse(el?.textContent ?? 'null')
    const route = data?.payload?.codeViewEditRoute
    const ref = route?.refInfo?.name
    const path = route?.path
    if (typeof ref === 'string' && typeof path === 'string') return { ref, path }
  } catch {
    // ignore
  }
  return null
}
