# pi-mermaid

Render mermaid diagrams from Pi output as PNG images in the terminal.

## Goal

`pi` already renders mermaid as themed Unicode inside the transcript (`markdown.mermaid`, default
`streaming`). That is fine for small diagrams and useless for dense ones, because the drawing is
squeezed into the terminal width. This package adds the missing path: turn a mermaid block into a
real PNG with `mmdc`, then show that PNG inline with Pi's image support.

## Verified before writing code

| Check | Result |
|---|---|
| mermaid to PNG | `mermaid-cli` 11.17.0 from nixpkgs, 2.6s per render after the first (first pays a 280 MB Chromium fetch) |
| Terminal display | `read` on a PNG shows inline through herdr with no protocol override |
| Extension API | `pi.registerTool` plus an image block in `content` is the same path the built-in `read` tool uses |

## Shape

```
AI output (```mermaid block)
   |
   v
extension: detect -> mmdc -> PNG
   |
   v
inline image in the transcript
```

## Files

- `extensions/mermaid/detect.ts` finds mermaid fenced blocks in markdown.
- `extensions/mermaid/render.ts` resolves a renderer (mmdc on PATH, else `nix-shell -p mermaid-cli`)
  and produces the PNG.
- `extensions/mermaid/index.ts` registers the `render_mermaid` tool and the `/mermaid` command.

## Steps

1. Project skeleton.
2. detect.ts and render.ts with unit tests runnable by node.
3. index.ts: tool, command, renderer.
4. Real run through Pi.
5. Side-by-side demo: Unicode-rendered mermaid block against the same diagram as PNG.
6. README and publish readiness.

## Status

(append as work proceeds)
