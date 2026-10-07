# GitHub Markdown WYSIWYG

Edit Markdown files on github.com in a rich-text (WYSIWYG) editor, and commit with GitHub's normal flow.

## Features

- Adds a **Rich text** option next to GitHub's **Edit / Preview** control on any `.md` file edit page.
- Renders the document with GitHub's own Markdown styles, in light and dark themes.
- Supports headings, bold/italic/strikethrough, links, lists, task lists, tables, quotes, code blocks with syntax highlighting, and images. It has a formatting bar, a selection toolbar and a `/` command menu.
- **Minimal diffs.** Blocks you do not touch keep their exact original Markdown, so a one-word edit gives a one-line commit diff. New text follows the file's existing style (`-` vs `*` bullets, `_` vs `*` emphasis, and so on).
- Keeps front matter, HTML blocks, link reference definitions, line endings and the trailing newline.
- Remembers your last mode, so the next Markdown file opens in rich text mode if you used it last.

## Why a new extension

These options existed in October 2026:

| Extension | Status | Edits `.md` files in a repo? |
|---|---|---|
| [GitHub Writer](https://github.com/ckeditor/github-writer) (CKEditor) | Archived on 2025-09-08 | No. Issues, PRs, comments and wikis only |
| [Gitcasso](https://github.com/diffplug/gitcasso) | Active | No. Syntax highlighting and drafts for comments, not WYSIWYG |
| [md-editor-ext](https://github.com/jjasser87/md-editor-ext) | Active | No. Local files only |

None of them edit repository Markdown files in WYSIWYG mode.

## Installation

### Manual Installation (Development)

1. Clone this repository.
2. Run `npm install && npm run build`.
3. Open `chrome://extensions/` in Chrome.
4. Enable "Developer mode".
5. Click "Load unpacked" and select this extension's directory.

Also works in Edge, Brave, Arc, and other Chromium browsers.

## Usage

1. Open a Markdown file on github.com and click the pencil (edit) icon.
2. Click **Rich text** next to **Edit / Preview**.
3. Edit the document. Type `/` for the block menu, or select text for the formatting toolbar.
4. Click **Commit changes...** as usual.

Click **Edit** at any time to see or change the Markdown source. Your rich-text changes are already in it.

## How it works

```
github.com edit page
├── GitHub's source editor (CodeMirror 6)  ← hidden in rich mode, still the source of truth
├── bridge-main.js   (page world)    reads/writes the CodeMirror document via view.dispatch
├── loader.js        (content script) adds the toggle, manages modes, lazy-loads the editor
└── editor.js        (injected on demand) Milkdown/Crepe editor + Markdown merge
```

- GitHub's commit dialog, unsaved-changes warning and branch/PR flow all read GitHub's own editor. The extension writes every change into that editor, so nothing in GitHub's flow changes.
- `src/markdown/preserve.ts` aligns the editor's output with the original file block by block. It reuses the original text of every unchanged block. This keeps commit diffs small, even though WYSIWYG editors normalize Markdown.
- github.com's Content Security Policy blocks third-party images (badges, for example) in the page. The editor shows them through GitHub's image proxy (camo), found with GitHub's public Markdown API. The Markdown keeps the original URLs.

## Limitations

- Image upload (paste or drop) works only in GitHub's **Edit** mode. In rich text mode, insert images by link.
- HTML blocks show as raw HTML text. They are kept unchanged unless you edit them.
- Math (`$...$`) and MDX files are not supported in rich text mode.
- Editing one item in a list rewrites that list's Markdown (other blocks stay unchanged).

## Permissions

| Permission | Why |
|---|---|
| `https://github.com/*` | Adds the toggle to github.com's file editor and reads/writes its content |
| `scripting` | Injects the large editor bundle only when you open rich text mode |
| `storage` | Remembers whether you prefer rich text mode |

## Privacy

This extension does not collect, store, or transmit any user data. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

## Development

```bash
npm install
npm run build        # bundle into dist/
npm run watch        # rebuild on change
npm run typecheck
npm test             # unit tests (Markdown merge)
npm run test:e2e     # loads the extension in Chromium against a mock GitHub edit page
```

After `npm run build`, click the reload icon on the extension in `chrome://extensions/`.

## Packaging

```bash
./package.sh
```

This builds the extension and creates `github-markdown-wysiwyg-v{version}.zip`, ready for Chrome Web Store upload.
