# The Mind of Nox

An [Eleventy](https://www.11ty.dev/) static site generated from an Obsidian vault.

## Source of truth

All content lives in the Obsidian vault:

```
D:\Personal\Dropbox\Notebook\Writing\Tag And Tally\The Mind of Nox
```

The site is a **mirror** of that vault — its URL structure follows the vault's folder
structure. Edit notes in Obsidian, then run the sync to regenerate the site's content.

## Workflow

```sh
npm run sync     # mirror the vault into src/www/, converting Obsidian syntax
npm run serve    # local preview at http://127.0.0.1:8099
npm run build    # production build into _site/
npm run dev      # netlify dev
```

`npm run sync` is **idempotent** — it wipes the previously generated content and
regenerates from scratch, so deletions and renames in the vault always propagate.
Generated markdown is committed to the repo (Netlify builds from git and has no access
to Dropbox).

### What gets published

- Everything **except** paths with a segment starting with `_` or `.`
  (`_archive`, `_system`, `_mechanics`, `.obsidian`, …). `secrets/` **is** published.
- A note with `publish: false` in its front matter is skipped, even inside a published
  folder.
- The vault's root-level `index.md` is skipped — the site homepage is generated from
  collections (recent sessions + a section index).

### Vault → site conversions

Handled by [`scripts/lib/convert.mjs`](scripts/lib/convert.mjs):

- Obsidian callouts (`> [!npc]`, `> [!item]`, …) → `{% sentence %}` shortcodes
  (`> [!ai]` → paired `{% note %}`), rendered as themeable `.callout` elements.
- Tally code-spans (`` `boxes:3/5` ``, `circles`, `clocks`) → `{% tally %}` shortcodes.
- Image embeds (`![[file.png]]`) → markdown images; the referenced files are copied out
  of the vault into `src/assets/images/vault/` and served from `/images/vault/`.
- `--` → em-dash (—), the vault's convention. Code spans and markdown `---` rules
  are left untouched.
- Wikilinks (`[[target|display]]`, `[[note#Heading]]`) → real markdown links,
  resolved against every published note (Obsidian-style basename lookup) with heading
  anchors slugified to match the site's generated heading ids. Targets that don't resolve
  to a published page fall back to plain display text (no broken links).

### Overriding the vault location

Set `NOX_VAULT_DIR` to point the sync at a different vault path:

```sh
NOX_VAULT_DIR="/some/other/vault" npm run sync     # bash
$env:NOX_VAULT_DIR="D:\other\vault"; npm run sync   # PowerShell
```

## Theme

The current theme is an intentionally minimal, blank scaffold
([`src/assets/css/main.css`](src/assets/css/main.css), layouts in
[`src/layouts/`](src/layouts/)). Markup classes (`.callout`, `.callout--<type>`,
`.tally`, `.session`, `.page`) are stable, so styling can be layered on without changing
the content pipeline.
