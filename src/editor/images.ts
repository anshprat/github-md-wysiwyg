/**
 * Image URL resolution for the WYSIWYG view.
 *
 * - Relative paths resolve against the file's raw URL, like GitHub's own
 *   rendering (`/owner/repo/raw/<ref>/<dir>/img.png`).
 * - github.com's Content Security Policy blocks third-party images (badges
 *   and the like) inside the page. GitHub proxies those through camo, so the
 *   camo URL is looked up via GitHub's public Markdown rendering API.
 *
 * Only the displayed `src` changes. The Markdown keeps the original URL.
 */

// Hosts allowed by github.com's `img-src` directive.
const CSP_ALLOWED = [
  /^github\.com$/,
  /\.githubusercontent\.com$/,
  /^github\.githubassets\.com$/,
  /\.googleusercontent\.com$/,
  /^github-cloud\.s3\.amazonaws\.com$/,
]

export interface ImageContext {
  /** Raw URL of the file being edited, e.g. https://github.com/o/r/raw/main/docs/README.md */
  fileRawUrl: string
  /** Raw URL of the repository root at the current ref, if known. */
  repoRawRoot?: string
}

export function createImageResolver(ctx: ImageContext): (src: string) => Promise<string> {
  const camo = createCamoLookup()
  return async (src: string) => {
    if (!src) return src
    if (/^(data|blob):/i.test(src)) return src
    let url: URL
    try {
      if (src.startsWith('/') && !src.startsWith('//') && ctx.repoRawRoot) {
        url = new URL(src.slice(1), ctx.repoRawRoot)
      } else {
        url = new URL(src, ctx.fileRawUrl)
      }
    } catch {
      return src
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return src
    if (url.protocol === 'https:' && CSP_ALLOWED.some((re) => re.test(url.hostname))) return url.href
    return (await camo(url.href)) ?? url.href
  }
}

/**
 * Batches lookups made in the same tick into one POST /markdown request.
 * Unauthenticated calls are rate limited (60/hour), so results are cached and
 * failures fall back to the original URL.
 */
function createCamoLookup(): (url: string) => Promise<string | null> {
  const cache = new Map<string, Promise<string | null>>()
  let pending: Array<{ url: string; resolve: (v: string | null) => void }> = []
  let timer: ReturnType<typeof setTimeout> | null = null

  async function run(batch: typeof pending) {
    const result = new Map<string, string>()
    try {
      const text = batch.map((b, i) => `![${i}](<${b.url}>)`).join('\n\n')
      const res = await fetch('https://api.github.com/markdown', {
        method: 'POST',
        headers: { Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode: 'gfm' }),
      })
      if (res.ok) {
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
        for (const img of doc.querySelectorAll('img[data-canonical-src]')) {
          result.set(img.getAttribute('data-canonical-src')!, img.getAttribute('src')!)
        }
      }
    } catch {
      // Offline or rate limited: show the original URL.
    }
    for (const b of batch) b.resolve(result.get(b.url) ?? null)
  }

  return (url) => {
    let hit = cache.get(url)
    if (!hit) {
      hit = new Promise((resolve) => pending.push({ url, resolve }))
      cache.set(url, hit)
      if (!timer) {
        timer = setTimeout(() => {
          const batch = pending
          pending = []
          timer = null
          void run(batch)
        }, 30)
      }
    }
    return hit
  }
}
