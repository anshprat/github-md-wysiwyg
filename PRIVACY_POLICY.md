# Privacy Policy for GitHub Markdown WYSIWYG

**Last Updated:** 2026-10-07

## Overview

GitHub Markdown WYSIWYG is a Chrome extension that lets you edit Markdown files on github.com in a rich-text (WYSIWYG) editor. This privacy policy explains our data practices.

## Data Collection and Usage

**We do not collect, store, or transmit any user data.**

This extension:
- Does NOT collect any personal information
- Does NOT track user behavior or browsing history
- Does NOT use analytics or telemetry services
- Stores one setting locally in your browser: whether you prefer rich-text mode

## Permissions

### Host permission: `https://github.com/*`

> The extension runs only on github.com. It adds the "Rich text" option to the file editor and reads and writes the content of GitHub's own editor on that page.

### `scripting`

> The rich-text editor is large, so it is injected into the github.com tab only when you open rich-text mode, instead of on every GitHub page.

### `storage`

> Remembers whether you last used rich-text mode, so the next Markdown file opens the same way. The value stays in your browser.

## What the Extension Does

On a Markdown file's edit page on github.com, the extension shows a WYSIWYG editor in place of GitHub's source editor. Every change is written back into GitHub's source editor on the same page. You commit with GitHub's normal "Commit changes" flow. The extension does not commit, push, or call GitHub on your behalf.

## Third-Party Services

The only network request the extension makes is to GitHub's public Markdown API (`https://api.github.com/markdown`). github.com blocks images from other sites, so the extension asks GitHub for its image-proxy (camo) address of third-party images in the file, such as status badges. Only those image URLs are sent, to GitHub. No credentials are sent with this request.

## Data Security

The extension does not handle credentials, tokens, or file content outside the github.com page you are editing.

## Children's Privacy

This extension does not knowingly collect information from children under 13 years of age.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this document.

## Contact Information

If you have any questions about this privacy policy, please open an issue on our GitHub repository:
https://github.com/anshprat/github-md-wysiwyg

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)

## Summary

In simple terms: the extension changes how GitHub's file editor looks and works in your browser. It does not collect, store, or share any information about you or your browsing activity.
