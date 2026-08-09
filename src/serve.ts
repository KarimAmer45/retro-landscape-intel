import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, join, normalize, relative, sep } from "node:path";

const port = Number(process.env.PORT ?? 4173);
const root = process.cwd();
// The working directory also holds sources, .env, and .git, so only build outputs are exposed.
const servedDirectories = new Set(["dashboard", "dist", "docs", "data"]);
const types: Record<string, string> = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  // Browsers download text/markdown instead of rendering it; the brief and model card are meant to be read.
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml"
};

function resolveServedPath(pathname: string): string | undefined {
  const requested = pathname === "/" ? "/dashboard/index.html" : pathname;
  const path = normalize(join(root, requested));
  const relativePath = relative(root, path);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) return undefined;
  const [topLevel] = relativePath.split(sep);
  return topLevel !== undefined && servedDirectories.has(topLevel) ? path : undefined;
}

const server = createServer(async (request, response) => {
  let path: string | undefined;
  try {
    path = resolveServedPath(new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`).pathname);
  } catch {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Bad request");
    return;
  }
  if (!path) { response.writeHead(403, { "content-type": "text/plain; charset=utf-8" }).end("Forbidden"); return; }
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" });
    const stream = createReadStream(path);
    // A read failure after the headers are sent would otherwise be an unhandled 'error' event.
    stream.on("error", () => response.destroy());
    response.on("close", () => stream.destroy());
    stream.pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => console.log(`Dashboard: http://127.0.0.1:${port}`));
