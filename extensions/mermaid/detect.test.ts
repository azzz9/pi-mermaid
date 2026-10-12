import assert from "node:assert/strict";
import { test } from "node:test";
import { extractMermaidBlocks, hasMermaidBlock } from "./detect.ts";

test("extracts one block and keeps its exact span", () => {
  const markdown = "before\n\n```mermaid\nflowchart TD\n  A --> B\n```\n\nafter\n";
  const blocks = extractMermaidBlocks(markdown);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.code, "flowchart TD\n  A --> B");
  assert.equal(markdown.slice(blocks[0]!.start, blocks[0]!.end), "```mermaid\nflowchart TD\n  A --> B\n```");
});

test("extracts several blocks in order", () => {
  const markdown = [
    "```mermaid",
    "flowchart TD",
    "  A --> B",
    "```",
    "",
    "text",
    "",
    "```mermaid",
    "sequenceDiagram",
    "  A->>B: hi",
    "```",
  ].join("\n");
  const blocks = extractMermaidBlocks(markdown);
  assert.deepEqual(blocks.map((block) => block.code.split("\n")[0]), ["flowchart TD", "sequenceDiagram"]);
});

test("ignores other languages and empty diagrams", () => {
  const markdown = "```ts\nconst a = 1;\n```\n\n```mermaid\n```\n";
  assert.equal(extractMermaidBlocks(markdown).length, 0);
  assert.equal(hasMermaidBlock(markdown), false);
});

test("honors an indented fence so it closes at the same depth", () => {
  const markdown = "- item\n\n  ```mermaid\n  flowchart TD\n    A --> B\n  ```\n";
  const blocks = extractMermaidBlocks(markdown);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.code, "flowchart TD\n    A --> B");
});
