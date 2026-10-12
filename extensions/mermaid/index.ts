/**
 * Pi extension: render mermaid as inline PNG images.
 *
 * Three paths, all optional and independent:
 * - `render_mermaid` tool: the model asks for a diagram as an image.
 * - `/mermaid`: renders a fence already in the transcript.
 * - auto: when a reply contains mermaid fences, each one is rendered and appended as a custom
 *   entry right after the turn. Custom entries never reach the model, so a picture costs no
 *   context. Set `PI_MERMAID_AUTO=off` to disable this path.
 */
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { Type } from "@earendil-works/pi-ai";
import {
  defineTool,
  type ExtensionAPI,
  type ExtensionContext,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import { Image, matchesKey, type Component } from "@earendil-works/pi-tui";
import { extractMermaidBlocks } from "./detect.ts";
import { renderMermaidPng } from "./render.ts";

const ENTRY_TYPE = "pi-mermaid";

interface MermaidEntry {
  path: string;
  bytes: number;
  ms: number;
  renderer: string;
}

const RenderParams = Type.Object({
  code: Type.String({
    description: "Mermaid diagram source, for example 'flowchart TD\\n  A --> B'",
  }),
  scale: Type.Optional(Type.Number({ description: "Device scale factor. Default 2." })),
  background: Type.Optional(
    Type.String({ description: "Background color. Default white; use transparent for none." }),
  ),
});

export default function (pi: ExtensionAPI): void {
  const autoRender = process.env.PI_MERMAID_AUTO !== "off";
  const handled = new Set<string>();

  const render = async (code: string, scale?: number, background?: string) => {
    const rendered = await renderMermaidPng(
      (command, args, options) => pi.exec(command, args, options),
      code,
      { scale, background },
    );
    const data = await readFile(rendered.filePath);
    const entry: MermaidEntry = {
      path: rendered.filePath,
      bytes: rendered.bytes,
      ms: rendered.ms,
      renderer: rendered.renderer,
    };
    return { entry, base64: data.toString("base64") };
  };

  pi.registerEntryRenderer<MermaidEntry>(ENTRY_TYPE, (entry, _options, theme) => {
    const data = entry.data;
    if (!data?.path) return new Text(theme.fg("dim", "mermaid: no image path"), 0, 0);
    try {
      const base64 = readFileSync(data.path).toString("base64");
      return new Image(
        base64,
        "image/png",
        { fallbackColor: (text) => theme.fg("dim", text) },
        { filename: data.path },
      );
    } catch {
      return new Text(theme.fg("dim", `mermaid: cannot read ${data.path}`), 0, 0);
    }
  });

  pi.registerTool(defineTool({
    name: "render_mermaid",
    label: "Render Mermaid",
    description:
      "Render mermaid diagram source to a PNG and show it inline in the terminal. Prefer this over a ```mermaid code block when the diagram is dense enough that the terminal's Unicode rendering would distort it.",
    parameters: RenderParams,

    async execute(_toolCallId, params) {
      const { entry, base64 } = await render(params.code, params.scale, params.background);
      return {
        content: [
          {
            type: "text",
            text: `Rendered in ${entry.ms} ms via ${entry.renderer}, ${entry.bytes} bytes. File: ${entry.path}`,
          },
          { type: "image", data: base64, mimeType: "image/png" },
        ],
        details: entry,
      };
    },
  }));

  pi.registerCommand("mermaid", {
    description: "Render a mermaid block from this session as a PNG. Usage: /mermaid [blockNumber]",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/mermaid needs interactive mode", "error");
        return;
      }
      const blocks = sessionBlocks(ctx);
      if (blocks.length === 0) {
        ctx.ui.notify("No mermaid blocks in this session", "warning");
        return;
      }
      const requested = Number.parseInt(args.trim(), 10);
      const index = Number.isFinite(requested) && requested > 0
        ? Math.min(requested, blocks.length) - 1
        : blocks.length - 1;
      ctx.ui.notify(`Rendering block ${index + 1} of ${blocks.length}...`, "info");
      try {
        const { entry, base64 } = await render(blocks[index]!);
        await ctx.ui.custom<void>((_tui, theme, _keybindings, done) =>
          new DiagramPane(base64, entry, theme, () => done())
        );
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  if (autoRender) {
    pi.on("agent_settled", async (_event, ctx) => {
      if (ctx.mode !== "tui") return;
      const last = lastAssistantMessage(ctx);
      if (!last || handled.has(last.id)) return;
      const blocks = extractMermaidBlocks(last.text);
      if (blocks.length === 0) return;
      handled.add(last.id);
      for (const block of blocks) {
        try {
          const { entry } = await render(block.code);
          pi.appendEntry<MermaidEntry>(ENTRY_TYPE, entry);
        } catch (error) {
          ctx.ui.notify(`mermaid: ${error instanceof Error ? error.message : String(error)}`, "error");
          break;
        }
      }
    });
  }
}

function lastAssistantMessage(ctx: ExtensionContext): { id: string; text: string } | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let index = branch.length - 1; index >= 0; index--) {
    const entry = branch[index];
    if (!entry || entry.type !== "message") continue;
    if (entry.message.role !== "assistant") continue;
    const text = messageText(entry.message.content);
    if (!text) return undefined;
    return { id: String(entry.id ?? index), text };
  }
  return undefined;
}

function sessionBlocks(ctx: ExtensionContext): string[] {
  const blocks: string[] = [];
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "message") continue;
    if (entry.message.role !== "assistant") continue;
    const text = messageText(entry.message.content);
    if (!text) continue;
    for (const block of extractMermaidBlocks(text)) blocks.push(block.code);
  }
  return blocks;
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part): part is { type: "text"; text: string } =>
      typeof part === "object" && part !== null && (part as { type?: string }).type === "text"
    )
    .map((part) => part.text)
    .join("\n");
}

class DiagramPane implements Component {
  private image: Image;

  constructor(
    base64: string,
    private info: MermaidEntry,
    private theme: Theme,
    private close: () => void,
  ) {
    this.image = new Image(
      base64,
      "image/png",
      { fallbackColor: (text) => theme.fg("dim", text) },
      { filename: info.path },
    );
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || matchesKey(data, "enter")) {
      this.close();
    }
  }

  render(width: number): string[] {
    const size = `${this.info.renderer} / ${this.info.ms} ms / ${Math.round(this.info.bytes / 1024)} KB`;
    return [
      "",
      ...this.image.render(width),
      "",
      `  ${this.theme.fg("muted", "mermaid")} ${this.theme.fg("dim", size)}`,
      `  ${this.theme.fg("dim", this.info.path)}`,
      `  ${this.theme.fg("dim", "Escape to close")}`,
      "",
    ];
  }

  invalidate(): void {
    this.image.invalidate();
  }
}
