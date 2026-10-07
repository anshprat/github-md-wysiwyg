/**
 * The WYSIWYG editor bundle. It is injected on demand (only when the user
 * opens rich-text mode) and exposes `open()` on `globalThis.__gmwEditor` for
 * the content script, which shares this isolated world.
 */
import './editor.css'

import { languages } from '@codemirror/language-data'
import { CrepeBuilder } from '@milkdown/crepe/builder'
import { blockEdit } from '@milkdown/crepe/feature/block-edit'
import { codeMirror } from '@milkdown/crepe/feature/code-mirror'
import { cursor } from '@milkdown/crepe/feature/cursor'
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip'
import { listItem } from '@milkdown/crepe/feature/list-item'
import { placeholder } from '@milkdown/crepe/feature/placeholder'
import { table } from '@milkdown/crepe/feature/table'
import { toolbar } from '@milkdown/crepe/feature/toolbar'
import { topBar } from '@milkdown/crepe/feature/top-bar'
import { imageInlineComponent, inlineImageConfig } from '@milkdown/kit/component/image-inline'
import { commandsCtx, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core'
import { uploadConfig } from '@milkdown/kit/plugin/upload'
import { insertImageCommand } from '@milkdown/kit/preset/commonmark'
import { $remark } from '@milkdown/kit/utils'

import { MarkdownSession } from '../markdown/session'
import { githubCodeTheme } from './code-theme'
import { createImageResolver, type ImageContext } from './images'

const IMAGE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19 5V19H5V5H19ZM19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM14.14 11.86L11.14 15.73L9 13.14L6 17H18L14.14 11.86Z"/></svg>`

/**
 * Milkdown's image node requires a string title, but Markdown images without
 * a title parse with `title: null`. Normalize before Milkdown sees the tree.
 */
const remarkImageTitles = $remark('gmwImageTitles', () => () => (tree) => {
  const walk = (node: { type: string; title?: unknown; children?: unknown[] }) => {
    if (node.type === 'image' && node.title == null) node.title = ''
    node.children?.forEach((c) => walk(c as typeof node))
  }
  walk(tree as Parameters<typeof walk>[0])
})

const insertImage = (ctx: import('@milkdown/kit/ctx').Ctx) =>
  ctx.get(commandsCtx).call(insertImageCommand.key, { src: '', alt: '', title: '' })

export interface OpenOptions {
  /** Element the editor renders into. */
  root: HTMLElement
  /** Current content of the file (from GitHub's source editor). */
  fileText: string
  images: ImageContext
  /** Called with the full new file content after the user edits. */
  onFileChange: (text: string) => void
  /** Called when the user tries something rich mode cannot do yet. */
  onNotice: (message: string) => void
  /** Debounce for onFileChange, in ms. */
  debounceMs?: number
}

export interface RichEditor {
  /** Pushes any pending change to onFileChange right away. */
  flush(): void
  focus(): void
  /** Tears the editor down. Pending changes are dropped; call flush() first to keep them. */
  destroy(): Promise<void>
}

async function open(opts: OpenOptions): Promise<RichEditor> {
  const session = new MarkdownSession(opts.fileText)
  const resolveImage = createImageResolver(opts.images)

  const mount = document.createElement('div')
  mount.className = 'gmw-milkdown'
  opts.root.append(mount)

  const crepe = new CrepeBuilder({ root: mount, defaultValue: session.body })
  const uploadNotice = () =>
    opts.onNotice('Image upload works in GitHub’s Edit mode only. Switch to Edit and drop the image there.')

  crepe.editor
    .config((ctx) => {
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({ ...prev, ...session.style }))
      // Crepe's default "upload" turns pasted/dropped images into blob: URLs,
      // which would end up in the committed Markdown.
      ctx.update(uploadConfig.key, (prev) => ({
        ...prev,
        uploader: async () => {
          uploadNotice()
          return []
        },
      }))
      ctx.update(inlineImageConfig.key, (prev) => ({
        ...prev,
        imageIcon: IMAGE_ICON,
        uploadButton: 'Upload',
        confirmButton: 'Insert',
        uploadPlaceholderText: 'Paste an image link',
        proxyDomURL: resolveImage,
        onUpload: async () => {
          uploadNotice()
          throw new Error('Image upload is not supported in rich text mode')
        },
      }))
    })
    .use(remarkImageTitles)
    .use(imageInlineComponent)

  // Crepe's own image feature ("image block") stores the image size in the alt
  // text, which would rewrite `![Screenshot](a.png)` as `![1.00](a.png)`.
  // Plain inline images keep Markdown as GitHub expects it.
  crepe
    .addFeature(cursor)
    .addFeature(listItem)
    .addFeature(linkTooltip)
    .addFeature(table)
    .addFeature(toolbar)
    .addFeature(topBar, {
      buildTopBar: (builder) =>
        builder.getGroup('insert').addItem('image', { icon: IMAGE_ICON, active: () => false, onRun: insertImage }),
    })
    .addFeature(blockEdit, {
      buildMenu: (builder) =>
        builder.getGroup('advanced').addItem('image', { label: 'Image', icon: IMAGE_ICON, onRun: insertImage }),
    })
    .addFeature(placeholder, { text: 'Type / for commands', mode: 'block' })
    .addFeature(codeMirror, { languages, theme: githubCodeTheme })

  let pending: ReturnType<typeof setTimeout> | null = null
  let ready = false
  const push = () => {
    if (pending) clearTimeout(pending)
    pending = null
    if (!ready) return
    opts.onFileChange(session.toFile(crepe.getMarkdown()))
  }
  crepe.on((listener) => {
    listener.markdownUpdated(() => {
      if (!ready) return
      if (pending) clearTimeout(pending)
      pending = setTimeout(push, opts.debounceMs ?? 150)
    })
  })

  await crepe.create()
  session.setBase(crepe.getMarkdown())
  ready = true

  // Render content with GitHub's own Markdown stylesheet.
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.dom.classList.add('markdown-body')
  })

  return {
    flush: push,
    focus: () => crepe.editor.action((ctx) => ctx.get(editorViewCtx).focus()),
    destroy: async () => {
      if (pending) clearTimeout(pending)
      ready = false
      await crepe.destroy()
      mount.remove()
    },
  }
}

;(globalThis as Record<string, unknown>).__gmwEditor = { open }
