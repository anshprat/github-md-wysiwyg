/**
 * Runs in the page's main world. GitHub's file editor is a CodeMirror 6
 * EditorView; its instance hangs off the `.cm-content` element as an expando
 * (`cmTile` in current CodeMirror, `cmView` in older versions), which only
 * main-world code can see. Changes go through `view.dispatch`, exactly like
 * typing, so GitHub's own state (commit dialog, unsaved-changes guard) stays
 * in sync.
 */
import { type BridgeRequest, type BridgeResponse, REQUEST_EVENT, RESPONSE_EVENT } from './protocol'

interface CMView {
  state: { doc: { length: number; toString(): string } }
  dispatch(spec: unknown): void
  focus(): void
}

function isView(v: unknown): v is CMView {
  const x = v as CMView | null
  return !!x && typeof x.dispatch === 'function' && !!x.state?.doc && typeof x.state.doc.toString === 'function'
}

function findView(): CMView | null {
  const content =
    document.querySelector('[data-testid="codemirror-editor"] .cm-content') ??
    document.querySelector('.cm-editor .cm-content')
  if (!content) return null
  for (const el of [content, content.closest('.cm-editor')]) {
    if (!el) continue
    for (const key of ['cmTile', 'cmView']) {
      const tile = (el as unknown as Record<string, any>)[key]
      for (const candidate of [tile, tile?.view, tile?.rootView?.view, tile?.root?.view]) {
        if (isView(candidate)) return candidate
      }
    }
  }
  return null
}

/** Replaces only the range that differs, so undo and cursor stay sensible. */
function setDoc(view: CMView, text: string): void {
  const cur = view.state.doc.toString()
  if (cur === text) return
  let start = 0
  const max = Math.min(cur.length, text.length)
  while (start < max && cur.charCodeAt(start) === text.charCodeAt(start)) start++
  let endCur = cur.length
  let endNew = text.length
  while (endCur > start && endNew > start && cur.charCodeAt(endCur - 1) === text.charCodeAt(endNew - 1)) {
    endCur--
    endNew--
  }
  view.dispatch({
    changes: { from: start, to: endCur, insert: text.slice(start, endNew) },
    userEvent: 'input.wysiwyg',
  })
}

function handle(req: BridgeRequest): BridgeResponse {
  const view = findView()
  if (!view) return { id: req.id, ok: false, error: 'CodeMirror editor not found' }
  switch (req.op) {
    case 'get':
      return { id: req.id, ok: true, text: view.state.doc.toString() }
    case 'set':
      setDoc(view, req.text)
      return { id: req.id, ok: true }
    case 'focus':
      view.focus()
      return { id: req.id, ok: true }
  }
}

document.addEventListener(REQUEST_EVENT, (e) => {
  let res: BridgeResponse
  let req: BridgeRequest
  try {
    req = JSON.parse((e as CustomEvent<string>).detail)
  } catch {
    return
  }
  try {
    res = handle(req)
  } catch (err) {
    res = { id: req.id, ok: false, error: String(err) }
  }
  document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: JSON.stringify(res) }))
})
