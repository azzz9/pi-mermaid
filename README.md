# @azzz9/pi-mermaid

Render mermaid diagrams from Pi output as PNG images in the terminal.

Pi already draws mermaid as themed Unicode inside the transcript (`markdown.mermaid`). That works
for small diagrams and distorts dense ones, because the drawing has to fit the terminal width.
This package adds the other path: turn a mermaid fence into a real PNG with `mermaid-cli` and show
it inline through Pi's image support.

## Install

```bash
pi install git:github.com/azzz9/pi-mermaid
```

Or add the directory to `packages` in `~/.pi/agent/settings.json`:

```json
{
  "packages": ["/home/you/src/pi-mermaid"]
}
```

For a quick trial without installing, pass the entry point directly:

```bash
pi --extension ./extensions/mermaid/index.ts
```

## Renderer requirement

The PNG comes from `mmdc` (mermaid-cli). Resolution order:

1. `mmdc` on `PATH`.
2. `nix-shell -p mermaid-cli --run mmdc`, when `nix-shell` exists. The first render pulls Chromium
   (about 280 MB); later renders take about 2.6 seconds.

On NixOS, either add `mermaid-cli` to `home.packages` or leave the nix-shell fallback in place.

## Usage

Three paths, all independent.

**Automatic.** Any mermaid fence in a reply is rendered after the turn and appended as an image
just below it. Custom entries never enter the model's context, so the picture is free. Disable it
with `PI_MERMAID_AUTO=off`.

**Tool.** `render_mermaid` lets the model ask for an image directly:

```json
{ "code": "flowchart TD\n  A --> B", "scale": 2, "background": "white" }
```

**Command.** `/mermaid` renders a fence already in the session. `/mermaid 2` picks the second one;
the default is the most recent.

## Terminal support

Inline images need a terminal that speaks the kitty or iTerm2 graphics protocol. Pi detects this
automatically, and a terminal multiplexer can make that detection wrong. Force it when the image
does not appear:

```json
{ "terminal": { "images": "kitty" } }
```

## Development

```bash
npm test                                  # detection and renderer resolution
PI_MERMAID_LIVE_TEST=1 npm test           # adds one real render through mmdc
```

## License

MIT
