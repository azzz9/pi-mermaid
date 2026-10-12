/**
 * Finds mermaid diagrams in markdown. The fence must be tagged `mermaid`; the closing fence must
 * use the same indentation as the opening one so nested lists do not truncate a diagram.
 */

export interface MermaidBlock {
  /** Diagram source without the fence lines. */
  code: string;
  /** Offset of the opening fence. */
  start: number;
  /** Offset just past the closing fence. */
  end: number;
}

const FENCE_PATTERN = /^([ \t]*)```+[ \t]*mermaid[^\n]*\r?\n([\s\S]*?)^\1```+[ \t]*$/gm;

export function extractMermaidBlocks(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  for (const match of markdown.matchAll(FENCE_PATTERN)) {
    const code = (match[2] ?? "").trim();
    if (!code) continue;
    const start = match.index ?? 0;
    blocks.push({ code, start, end: start + match[0].length });
  }
  return blocks;
}

export function hasMermaidBlock(markdown: string): boolean {
  return extractMermaidBlocks(markdown).length > 0;
}
