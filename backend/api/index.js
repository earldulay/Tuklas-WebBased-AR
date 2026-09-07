// Vercel serverless entry point. Plain JS (not TypeScript) so Vercel's
// function build doesn't run its own limited type-check pass on it — the
// real TypeScript source (src/app.ts) is compiled by our own `tsc` during
// `npm run vercel-build`, which honors the full tsconfig.json (including
// esModuleInterop), and this file just imports the compiled output.
//
// Every request under this project's domain is routed here (see
// vercel.json rewrites), and the original request path (e.g. /api/health)
// is preserved, so the Express app's own /api/* route prefixes still
// match unchanged.
import { createApp } from "../dist/app.js";

const app = createApp();

export default app;
