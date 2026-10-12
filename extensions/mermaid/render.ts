/**
 * Turns mermaid source into a PNG with mermaid-cli.
 *
 * The renderer is `mmdc` when it is on PATH. On a machine without it, `nix-shell -p mermaid-cli`
 * provides one, which costs a few seconds for the shell and the Chromium it pulls in on the first
 * render. Everything runs through the caller's exec so tests can inject a fake.
 */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type ExecFn = (
  command: string,
  args: string[],
  options?: { timeout?: number; cwd?: string },
) => Promise<ExecResult>;

export type RendererKind = "mmdc" | "nix-shell";

export interface Renderer {
  kind: RendererKind;
  command: string;
}

export interface RenderOptions {
  scale?: number;
  background?: string;
  timeoutMs?: number;
  /** Explicit mmdc path. Skips PATH probing. */
  command?: string;
}

export interface RenderedDiagram {
  filePath: string;
  bytes: number;
  ms: number;
  renderer: RendererKind;
  stderr: string;
}

export const DEFAULT_SCALE = 2;
export const DEFAULT_BACKGROUND = "white";
export const DEFAULT_TIMEOUT_MS = 180_000;

export async function findRenderer(exec: ExecFn, configured?: string): Promise<Renderer | undefined> {
  const explicit = configured?.trim();
  if (explicit) return { kind: "mmdc", command: explicit };
  const mmdc = await which(exec, "mmdc");
  if (mmdc) return { kind: "mmdc", command: mmdc };
  const nixShell = await which(exec, "nix-shell");
  if (nixShell) return { kind: "nix-shell", command: nixShell };
  return undefined;
}

async function which(exec: ExecFn, name: string): Promise<string | undefined> {
  try {
    const { code, stdout } = await exec("sh", ["-lc", `command -v ${name}`], { timeout: 15_000 });
    if (code !== 0) return undefined;
    return stdout.split("\n").map((line) => line.trim()).find(Boolean) || undefined;
  } catch {
    return undefined;
  }
}

export async function renderMermaidPng(
  exec: ExecFn,
  code: string,
  options: RenderOptions = {},
): Promise<RenderedDiagram> {
  const renderer = await findRenderer(exec, options.command);
  if (!renderer) {
    throw new Error(
      "no mermaid renderer found: put mermaid-cli (mmdc) on PATH, or make nix-shell available",
    );
  }

  const dir = await mkdtemp(join(tmpdir(), "pi-mermaid-"));
  const inputPath = join(dir, "diagram.mmd");
  const outputPath = join(dir, "diagram.png");
  const scale = options.scale ?? DEFAULT_SCALE;
  const background = options.background ?? DEFAULT_BACKGROUND;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  await writeFile(inputPath, code.endsWith("\n") ? code : `${code}\n`, "utf8");

  const mmdcArgs = ["-i", inputPath, "-o", outputPath, "-s", String(scale), "-b", background];
  const started = Date.now();
  const result = renderer.kind === "nix-shell"
    ? await exec(
      renderer.command,
      ["-p", "mermaid-cli", "--run", `mmdc ${mmdcArgs.map(shellQuote).join(" ")}`],
      { timeout },
    )
    : await exec(renderer.command, mmdcArgs, { timeout });
  const ms = Date.now() - started;

  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim().split("\n").slice(-6).join("\n");
    throw new Error(`mmdc exited ${result.code}: ${detail || "no output"}`);
  }

  const png = await readFile(outputPath);
  return { filePath: outputPath, bytes: png.byteLength, ms, renderer: renderer.kind, stderr: result.stderr };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
