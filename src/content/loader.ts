/**
 * Content script (isolated world) for github.com.
 *
 * On a Markdown file's edit page it adds a "Rich text" option next to
 * GitHub's Edit / Preview control. Rich mode hides GitHub's source editor,
 * shows a WYSIWYG editor in its place, and writes every change back into the
 * source editor, so GitHub's own commit flow keeps working unchanged.
 */
import type { OpenOptions, RichEditor } from '../editor'
import {
  currentFileName,
  type EditRoute,
  findModeButton,
  findModeControl,
  findSourceEditor,
  findSourceHost,
  isMarkdownFile,
  parseRoute,
  readEmbeddedRefInfo,
} from './github'
import { type BridgeRequest, type BridgeResponse, REQUEST_EVENT, RESPONSE_EVENT } from './protocol'

const MODE_ATTR = 'data-gmw-mode'
const HOST_ATTR = 'data-gmw-host'
const PREF_KEY = 'gmw.preferRich'

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

// ---- Bridge to GitHub's CodeMirror (main world) ---------------------------

function bridge(req: DistributiveOmit<BridgeRequest, 'id'>): BridgeResponse {
  const id = Math.random().toString(36).slice(2)
  let res: BridgeResponse | null = null
  const onResponse = (e: Event) => {
    const r = JSON.parse((e as CustomEvent<string>).detail) as BridgeResponse
    if (r.id === id) res = r
  }
  document.addEventListener(RESPONSE_EVENT, onResponse)
  document.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: JSON.stringify({ ...req, id }) }))
  document.removeEventListener(RESPONSE_EVENT, onResponse)
  return res ?? { id, ok: false, error: 'Bridge script did not answer' }
}

// ---- Lazy editor bundle ---------------------------------------------------

interface EditorApi {
  open(opts: OpenOptions): Promise<RichEditor>
}

let editorApi: Promise<EditorApi> | null = null

function loadEditor(): Promise<EditorApi> {
  editorApi ??= chrome.runtime.sendMessage({ type: 'gmw:load-editor' }).then((res) => {
    const api = (globalThis as { __gmwEditor?: EditorApi }).__gmwEditor
    if (!res?.ok || !api) {
      editorApi = null
      throw new Error(res?.error ?? 'Editor failed to load')
    }
    return api
  })
  return editorApi
}

// ---- Preference -------------------------------------------------------------

async function prefersRich(): Promise<boolean> {
  try {
    return (await chrome.storage.local.get(PREF_KEY))[PREF_KEY] === true
  } catch {
    return false
  }
}

function setPrefersRich(value: boolean): void {
  chrome.storage.local.set({ [PREF_KEY]: value }).catch(() => {})
}

// ---- Page state -------------------------------------------------------------

interface ActiveRich {
  container: HTMLElement
  editor: RichEditor | null
}

let toggleItem: HTMLLIElement | null = null
let rich: ActiveRich | null = null
let opening = false
let autoOpenedFor: string | null = null

function notice(message: string, where?: HTMLElement): void {
  const el = document.createElement('div')
  el.className = 'gmw-toast'
  el.setAttribute('role', 'status')
  el.textContent = message
  ;(where ?? document.body).append(el)
  setTimeout(() => el.remove(), 6000)
}

function imageContext(route: EditRoute): OpenOptions['images'] {
  const base = `${location.origin}/${route.owner}/${route.repo}/raw/`
  const fileRawUrl =
    route.kind === 'edit' ? base + encodeURI(route.rest) : base + encodeURI(route.rest.replace(/\/?$/, '/'))
  const info = readEmbeddedRefInfo()
  const repoRawRoot =
    info && route.rest === `${info.ref}/${info.path}` ? base + encodeURI(info.ref) + '/' : undefined
  return { fileRawUrl, repoRawRoot }
}

function setToggleSelected(selected: boolean): void {
  if (!toggleItem) return
  toggleItem.toggleAttribute('data-selected', selected)
  toggleItem.querySelector('button')?.setAttribute('aria-pressed', String(selected))
}

/** Shows GitHub's "Edit" segment as (un)selected without involving React. */
function setEditSegmentSelected(control: HTMLElement, selected: boolean): void {
  const edit = findModeButton(control, 'Edit')
  edit?.parentElement?.toggleAttribute('data-selected', selected)
  edit?.setAttribute('aria-pressed', String(selected))
}

async function enterRich(): Promise<void> {
  if (rich || opening) return
  const route = parseRoute(location.pathname)
  const control = findModeControl()
  if (!route || !control) return
  opening = true
  try {
    // Make sure GitHub shows its source editor (not Preview) underneath.
    const editButton = findModeButton(control, 'Edit')
    if (editButton?.getAttribute('aria-pressed') !== 'true') {
      editButton?.click()
      await new Promise((r) => setTimeout(r, 50))
    }
    const source = findSourceEditor()
    if (!source) throw new Error('GitHub’s source editor was not found on this page')
    const doc = bridge({ op: 'get' })
    if (!doc.ok || doc.text == null) throw new Error(doc.error ?? 'Could not read the file content')

    const host = findSourceHost(source)
    host.setAttribute(HOST_ATTR, '')
    const container = document.createElement('div')
    container.className = 'gmw-root'
    host.after(container)
    rich = { container, editor: null }

    document.documentElement.setAttribute(MODE_ATTR, 'rich')
    setEditSegmentSelected(control, false)
    setToggleSelected(true)

    const api = await loadEditor()
    const editor = await api.open({
      root: container,
      fileText: doc.text,
      images: imageContext(route),
      onFileChange: (text) => {
        const res = bridge({ op: 'set', text })
        if (!res.ok) notice(`Could not update the file: ${res.error}`, container)
      },
      onNotice: (message) => notice(message, container),
    })
    if (rich?.container !== container) {
      // The user left rich mode while the editor was loading.
      await editor.destroy()
      return
    }
    rich.editor = editor
    editor.focus()
  } catch (err) {
    console.error('[GitHub Markdown WYSIWYG]', err)
    await exitRich(true, false)
    notice(`Rich text mode is not available: ${(err as Error).message}`)
  } finally {
    opening = false
  }
}

/**
 * Leaves rich mode. `toEdit` re-selects GitHub's Edit segment; `flush` writes
 * pending edits first (skipped when the page is navigating away).
 */
async function exitRich(toEdit: boolean, flush = true): Promise<void> {
  const current = rich
  rich = null
  document.documentElement.removeAttribute(MODE_ATTR)
  setToggleSelected(false)
  const control = findModeControl()
  if (control && toEdit) setEditSegmentSelected(control, true)
  document.querySelectorAll(`[${HOST_ATTR}]`).forEach((el) => el.removeAttribute(HOST_ATTR))
  if (!current) return
  if (flush) current.editor?.flush()
  const container = current.container
  try {
    await current.editor?.destroy()
  } finally {
    container.remove()
  }
}

function createToggle(control: HTMLElement): HTMLLIElement | null {
  const template = findModeButton(control, 'Preview')?.parentElement
  if (!template) return null
  const li = template.cloneNode(true) as HTMLLIElement
  li.classList.add('gmw-toggle')
  li.removeAttribute('data-selected')
  const button = li.querySelector('button')!
  button.removeAttribute('id')
  button.setAttribute('aria-pressed', 'false')
  button.title = 'Edit this Markdown file as rich text (WYSIWYG)'
  const label = button.querySelector('[data-text]') ?? button
  label.textContent = 'Rich text'
  label.setAttribute('data-text', 'Rich text')
  button.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    setPrefersRich(true)
    void enterRich()
  })
  return li
}

/** While in rich mode, clicks on GitHub's Edit / Preview leave rich mode. */
function onControlClick(e: MouseEvent): void {
  if (!rich) return
  const button = (e.target as Element).closest('li > button')
  if (!button || button.closest('.gmw-toggle')) return
  const text = button.textContent?.trim()
  if (text === 'Edit') {
    setPrefersRich(false)
    void exitRich(true)
  } else if (text === 'Preview') {
    void exitRich(false)
  }
}

// ---- Keep in sync with GitHub's single-page navigation ---------------------

function sync(): void {
  const route = parseRoute(location.pathname)
  const control = route ? findModeControl() : null
  const eligible = !!route && !!control && isMarkdownFile(currentFileName(route))

  if (!eligible) {
    if (rich) void exitRich(false, false)
    toggleItem?.remove()
    toggleItem = null
    return
  }

  if (!toggleItem || !control.contains(toggleItem)) {
    toggleItem?.remove()
    toggleItem = createToggle(control)
    if (!toggleItem) return
    control.append(toggleItem)
    control.addEventListener('click', onControlClick, true)
    setToggleSelected(!!rich)
  }

  // The editor's container must stay next to the (possibly re-rendered)
  // source editor; if GitHub replaced that subtree, start over.
  if (rich && !rich.container.isConnected && !opening) void exitRich(true, false)

  const key = location.pathname
  if (!rich && !opening && autoOpenedFor !== key) {
    autoOpenedFor = key
    void prefersRich().then((yes) => {
      if (yes && parseRoute(location.pathname) && location.pathname === key) void enterRich()
    })
  }
}

let scheduled = false
function scheduleSync(): void {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    sync()
  })
}

new MutationObserver(scheduleSync).observe(document.documentElement, { childList: true, subtree: true })
document.addEventListener('input', (e) => {
  if ((e.target as Element).matches?.('input')) scheduleSync() // new-file name field
})
scheduleSync()

// Push pending edits before the user reaches for "Commit changes...".
document.addEventListener(
  'pointerdown',
  (e) => {
    if (rich?.editor && !rich.container.contains(e.target as Node)) rich.editor.flush()
  },
  true,
)
document.addEventListener('visibilitychange', () => rich?.editor?.flush())
