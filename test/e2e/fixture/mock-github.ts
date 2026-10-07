/**
 * A stand-in for github.com's file editor page, used by the e2e test.
 * It reproduces the parts the extension depends on (checked against the real
 * page): the "Edit mode" segmented control, a CodeMirror 6 editor inside a
 * `codeViewEdit` wrapper, and a Preview pane that hides (not unmounts) the
 * editor.
 */
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, basicSetup } from 'codemirror'

declare global {
  interface Window {
    __mock: { doc(): string; setDoc(text: string): void; previewShown(): boolean }
    __MOCK_FILE__: string
  }
}

const app = document.getElementById('app')!
app.innerHTML = `
  <div class="Panel-module__Box__AdYCI BlobEditor-module__Panel__LVzL1">
    <div class="BlobEditHeader-module__Box__zKgc2">
      <div class="BlobEditHeader-module__Box_1__O4EVb">
        <ul aria-label="Edit mode" class="prc-SegmentedControl-SegmentedControl-lqIXp" data-component="SegmentedControl">
          <li class="prc-SegmentedControl-Item-tSCQh" data-selected="" data-component="SegmentedControl.Button">
            <button aria-pressed="true" class="prc-SegmentedControl-Button-E48xz" type="button"><span class="prc-SegmentedControl-Content-1COlk"><div class="prc-SegmentedControl-Text-7S2y2" data-text="Edit">Edit</div></span></button>
          </li>
          <li class="prc-SegmentedControl-Item-tSCQh" data-component="SegmentedControl.Button">
            <button aria-pressed="false" class="prc-SegmentedControl-Button-E48xz" type="button"><span class="prc-SegmentedControl-Content-1COlk"><div class="prc-SegmentedControl-Text-7S2y2" data-text="Preview">Preview</div></span></button>
          </li>
        </ul>
      </div>
    </div>
    <div class="BlobEditor-module__codeViewEdit__QKzf7">
      <div class="is-default FileUpload-module__reactFileUpload__CQVtw"><div id="cm-parent"></div></div>
    </div>
    <div class="BlobEditor-module__Box_4__e0D53" id="preview" hidden><div class="markdown-body">Preview</div></div>
  </div>
  <button id="commit" type="button">Commit changes...</button>
`

const view = new EditorView({
  doc: window.__MOCK_FILE__,
  parent: document.getElementById('cm-parent')!,
  extensions: [basicSetup, markdown(), EditorView.editorAttributes.of({ 'data-testid': 'codemirror-editor' })],
})

// React-like segmented control: clicking the selected segment is a no-op.
let mode: 'edit' | 'preview' = 'edit'
const items = app.querySelectorAll<HTMLLIElement>('ul[aria-label="Edit mode"] > li')
const render = () => {
  const [edit, preview] = items
  edit.toggleAttribute('data-selected', mode === 'edit')
  edit.querySelector('button')!.setAttribute('aria-pressed', String(mode === 'edit'))
  preview.toggleAttribute('data-selected', mode === 'preview')
  preview.querySelector('button')!.setAttribute('aria-pressed', String(mode === 'preview'))
  const host = app.querySelector<HTMLElement>('[class*="codeViewEdit"]')!
  host.style.display = mode === 'edit' ? '' : 'none'
  document.getElementById('preview')!.hidden = mode !== 'preview'
}
items.forEach((li, i) =>
  li.querySelector('button')!.addEventListener('click', () => {
    const next = i === 0 ? 'edit' : 'preview'
    if (next === mode) return
    mode = next
    render()
  }),
)

window.__mock = {
  doc: () => view.state.doc.toString(),
  setDoc: (text) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
  previewShown: () => mode === 'preview',
}
