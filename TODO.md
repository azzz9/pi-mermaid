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

Done:

- Skeleton, `detect.ts`, `render.ts`, `index.ts`.
- Unit tests (11) plus a live render test that runs only with `PI_MERMAID_LIVE_TEST=1`.
- Real tool call through Pi: returned `/tmp/pi-mermaid-95KAia/diagram.png`.
- Automatic rendering after a turn: custom entry recorded in the session log.
- Default switched to a transparent background with an optional `theme`; verified through a real
  render as `srgba` with corner alpha 0.
- Side-by-side demo: mermaid fence against the same diagram as PNG.
- Published at https://github.com/azzz9/pi-mermaid (default branch `main`).

Remaining:

- Install into dotfiles: flake input plus a `rows` entry in `modules/pi.nix`.
- Optional npm publish. The git install path already works.
- Delete the leftover `master` branch on the remote; the agent is blocked from deleting refs.

## Environment found during verification

- Terminal under herdr is Ghostty, but herdr passes `TERM=xterm-256color`, so Pi's image-protocol
  detection fails. `terminal.images: "kitty"` fixes it.
- `markdown.mermaid` was unset and the default did not render; setting `"final"` made Pi draw
  mermaid as Unicode in the transcript.
