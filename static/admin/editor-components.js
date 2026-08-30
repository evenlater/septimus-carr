/**
 * Registers Septimus Carr's two BLOCK-level shortcodes as insertable,
 * previewed components in the Sveltia editor's "+" insert menu.
 *
 * What this does and doesn't cover:
 * - pull-quote and section-head are block-level (they wrap a whole
 *   paragraph/heading), so they get a real toolbar entry, a small form,
 *   and a styled live preview right in the editor.
 * - tl-note is INLINE (it wraps a few words in the middle of a running
 *   sentence and needs a `date` that must already exist in this post's
 *   historicalEvents list). Sveltia's editor-component system does not
 *   yet have a good inline insertion UI (this is an open item upstream,
 *   see sveltia/sveltia-cms discussion #560) — so for now, tl-note still
 *   has to be typed by hand in Raw Markdown mode:
 *
 *     {{< tl-note date="2026-05-13" >}}closing night{{< /tl-note >}}
 *
 *   The `date` must match one of this post's historicalEvents dates
 *   exactly (same string). `note=` is optional and overrides the
 *   sidenote caption.
 */

CMS.registerEditorComponent({
  id: 'pull-quote',
  label: 'Pull Quote',
  fields: [
    { name: 'body', label: 'Quote', widget: 'text' },
  ],
  pattern: /^{{< pull-quote >}}([\s\S]*?){{< \/pull-quote >}}$/,
  fromBlock: (match) => ({ body: match[1] }),
  toBlock: ({ body }) => `{{< pull-quote >}}${body}{{< /pull-quote >}}`,
  toPreview: ({ body }) =>
    `<div style="border-left:3px solid #2A0E38;margin:1em 0;padding:0.5em 1em;font-style:italic;">${body}</div>`,
});

CMS.registerEditorComponent({
  id: 'section-head',
  label: 'Section Head',
  fields: [
    { name: 'body', label: 'Heading text', widget: 'string' },
  ],
  pattern: /^{{< section-head >}}([\s\S]*?){{< \/section-head >}}$/,
  fromBlock: (match) => ({ body: match[1] }),
  toBlock: ({ body }) => `{{< section-head >}}${body}{{< /section-head >}}`,
  toPreview: ({ body }) => `<h2 style="text-transform:uppercase;">${body}</h2>`,
});
