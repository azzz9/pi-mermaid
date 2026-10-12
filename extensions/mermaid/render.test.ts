import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { findRenderer, renderMermaidPng, type ExecFn } from "./render.ts";

const shProbe = (line: string): string | undefined => {
  const match = /command -v (\S+)/.exec(line);
  return match?.[1];
};

test("prefers mmdc when it is on PATH", async () => {
  const exec: ExecFn = async (command, args) => {
    if (command === "sh" && shProbe(String(args[1])) === "mmdc") {
      return { code: 0, stdout: "/usr/bin/mmdc\n", stderr: "" };
    }
    return { code: 1, stdout: "", stderr: "" };
  };
  const renderer = await findRenderer(exec);
  assert.equal(renderer?.kind, "mmdc");
  assert.equal(renderer?.command, "/usr/bin/mmdc");
});

test("falls back to nix-shell when mmdc is missing", async () => {
  const exec: ExecFn = async (command, args) => {
    const name = command === "sh" ? shProbe(String(args[1])) : undefined;
    if (name === "nix-shell") return { code: 0, stdout: "/run/current-system/sw/bin/nix-shell\n", stderr: "" };
    return { code: 1, stdout: "", stderr: "" };
  };
  const renderer = await findRenderer(exec);
  assert.equal(renderer?.kind, "nix-shell");
});

test("an explicit command skips probing", async () => {
  const exec: ExecFn = async () => {
    throw new Error("should not probe");
  };
  const renderer = await findRenderer(exec, "/custom/mmdc");
  assert.equal(renderer?.command, "/custom/mmdc");
});

test("reports a missing renderer instead of rendering", async () => {
  const exec: ExecFn = async () => ({ code: 1, stdout: "", stderr: "" });
  assert.equal(await findRenderer(exec), undefined);
  await assert.rejects(() => renderMermaidPng(exec, "flowchart TD\n  A --> B"), /no mermaid renderer/);
});

test("surfaces the renderer's own failure text", async () => {
  const exec: ExecFn = async (command, args) => {
    const name = command === "sh" ? shProbe(String(args[1])) : undefined;
    if (name === "mmdc") return { code: 0, stdout: "/usr/bin/mmdc\n", stderr: "" };
    return { code: 1, stdout: "", stderr: "Error: Parse error on line 2" };
  };
  await assert.rejects(() => renderMermaidPng(exec, "not a diagram"), /Parse error on line 2/);
});

test("renders a real PNG", { skip: process.env.PI_MERMAID_LIVE_TEST !== "1" }, async () => {
  const exec: ExecFn = (command, args, options) =>
    new Promise((resolve) => {
      execFile(command, args, { timeout: options?.timeout, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
        resolve({ code: error ? 1 : 0, stdout: String(stdout), stderr: String(stderr) });
      });
    });
  const diagram = await renderMermaidPng(exec, "flowchart TD\n  A[alpha] --> B[beta]");
  assert.match(diagram.filePath, /\.png$/);
  assert.ok(diagram.bytes > 1000, `expected a real PNG, got ${diagram.bytes} bytes`);
  assert.ok(diagram.ms > 0);
});
