# Chrome Web Store Submission Guide

Answers for the Privacy practices tab when publishing.

## Store Listing Assets

Screenshots (1280×800, 24-bit PNG, no alpha) go in `store/`. They are not made yet.

- `store/screenshot-1.png` — Rich text mode on a README edit page
- `store/screenshot-2.png` — Formatting toolbar and slash menu
- `store/screenshot-3.png` — The commit diff: only edited lines change

## Single Purpose Description

> Edit Markdown files on github.com in a WYSIWYG (rich-text) editor that writes standard Markdown back into GitHub's own file editor.

## Permission Justifications

### Host permission: `https://github.com/*`

> The extension only works on github.com file edit pages. It adds a "Rich text" option and reads and writes the content of GitHub's file editor on the page.

### scripting

> Injects the rich-text editor bundle into the github.com tab only when the user opens rich-text mode, so other GitHub pages do not load it.

### storage

> Stores one local setting: whether the user prefers rich-text mode.

### Remote Code

> This extension does not use any remote code. All scripts are bundled in the
> package; no code is fetched from external servers, no dynamic code execution
> is used, and no code is injected from remote sources.

## Data Usage Certification

This extension:
- Does NOT collect, transmit, or sell user data
- Does NOT use analytics, telemetry, or tracking
- Does NOT store any data on a remote server

The only outbound request is to GitHub's public Markdown API, to get GitHub's image-proxy URLs for third-party images in the file being edited.

The extension complies with the Chrome Web Store Developer Program Policies regarding data handling and user privacy.
