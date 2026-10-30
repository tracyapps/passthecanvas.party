// The public routes get useful link-preview metadata even before JavaScript runs.
// This copies the same Vite app shell; it does not pretend to server-render the app.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const pages = JSON.parse(await readFile(path.join(root, 'src/lib/ui/public-pages.json'), 'utf8'));
const output = path.join(root, 'dist');
const shell = await readFile(path.join(output, 'index.html'), 'utf8');
const origin = new URL(process.env.VITE_PUBLIC_SITE_URL || 'https://passthecanvas-party.vercel.app').origin;
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const [route, page] of Object.entries(pages)) {
  const title = route === '/' ? 'Pass the Canvas — Make something. Together.' : `${page.title} — Pass the Canvas`;
  let html = shell.replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escape(page.description)}" />`);
  html = html.replace('</head>', `  <meta property="og:title" content="${escape(title)}" />\n    <meta property="og:description" content="${escape(page.description)}" />\n    <meta property="og:type" content="website" />\n    <meta property="og:site_name" content="Pass the Canvas" />\n    <meta property="og:url" content="${origin}${route}" />\n    <meta property="og:image" content="${origin}/site/studio-friends.webp" />\n    <meta property="og:image:alt" content="An emotional support crocheted dumpster, rubber duck and cassette in the studio." />\n  </head>`);
  const directory = route === '/' ? output : path.join(output, route.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), html);
}
await writeFile(path.join(output, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Not in this studio — Pass the Canvas</title><style>body{margin:0;background:#eee4cc;color:#30261e;font:20px/1.6 system-ui;padding:10vw}h1{font-size:clamp(40px,8vw,90px);line-height:1}a{display:inline-block;padding:12px 0;color:inherit}a:focus-visible{outline:3px solid #9c3a29}</style><main><p>PASS THE CANVAS</p><h1>That corner is<br>still a mystery.</h1><p>This page isn’t here. The paints are, though.</p><a href="/">Back to the studio</a><br><a href="/try">Try the paint table</a></main></html>');
console.log(`Public page metadata: ${Object.keys(pages).length} routes + 404.`);
