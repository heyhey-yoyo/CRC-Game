import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateContent } from './validate-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');

validateContent();
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const files = [
  'index.html', '404.html', 'styles.css', 'sw.js', 'manifest.webmanifest', '_headers', '_redirects', 'robots.txt',
  'js/content-loader.js', 'js/sim-engine.js', 'js/sim-worker.js', 'js/storage.js', 'js/app.js',
  'data/content-manifest.json', 'data/pathways.json', 'data/evidence.json', 'data/cases/case-b2m-escape.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'pages/methods.html', 'pages/references.html', 'pages/privacy.html', 'pages/accessibility.html'
];

for (const relative of files) {
  const source = path.join(root, relative);
  const target = path.join(dist, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

if (siteUrl) {
  const canonicalTargets = [
    ['index.html', '/'],
    ['pages/methods.html', '/pages/methods.html'],
    ['pages/references.html', '/pages/references.html'],
    ['pages/privacy.html', '/pages/privacy.html'],
    ['pages/accessibility.html', '/pages/accessibility.html']
  ];
  for (const [relative, route] of canonicalTargets) {
    const target = path.join(dist, relative);
    let page = fs.readFileSync(target, 'utf8');
    const tags = `  <link rel="canonical" href="${siteUrl}${route}">\n${relative === 'index.html' ? `  <meta property="og:url" content="${siteUrl}${route}">\n` : ''}`;
    page = page.replace('</head>', `${tags}</head>`);
    fs.writeFileSync(target, page);
  }
  const robots = `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;
  fs.writeFileSync(path.join(dist, 'robots.txt'), robots);
  const pages = ['', 'pages/methods.html', 'pages/references.html', 'pages/privacy.html', 'pages/accessibility.html'];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((item, index) => `  <url><loc>${siteUrl}/${item}</loc><changefreq>${index < 3 ? 'monthly' : 'yearly'}</changefreq><priority>${index === 0 ? '1.0' : index < 3 ? '0.7' : '0.3'}</priority></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap);
} else {
  fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  console.warn('SITE_URL is not set; sitemap.xml was not generated. Set SITE_URL for production custom-domain builds.');
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/content-manifest.json'), 'utf8'));
const buildInfo = {
  appVersion: manifest.appVersion,
  contentVersion: manifest.contentVersion,
  status: manifest.status,
  builtAt: new Date().toISOString(),
  commit: process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || null
};
fs.writeFileSync(path.join(dist, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);

function makeStandalone() {
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const content = {
    manifest: JSON.parse(fs.readFileSync(path.join(root, 'data/content-manifest.json'), 'utf8')),
    caseData: JSON.parse(fs.readFileSync(path.join(root, 'data/cases/case-b2m-escape.json'), 'utf8')),
    pathways: JSON.parse(fs.readFileSync(path.join(root, 'data/pathways.json'), 'utf8')),
    evidence: JSON.parse(fs.readFileSync(path.join(root, 'data/evidence.json'), 'utf8'))
  };
  const engine = fs.readFileSync(path.join(root, 'js/sim-engine.js'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'js/sim-worker.js'), 'utf8').replace(/importScripts\('\.\/sim-engine\.js'\);?/, '');
  const embeddedWorker = `${engine}\n${worker}`;
  const scripts = ['js/content-loader.js', 'js/sim-engine.js', 'js/storage.js', 'js/app.js'].map((file) => fs.readFileSync(path.join(root, file), 'utf8'));

  html = html
    .replace(/\s*<link rel="manifest"[^>]+>/, '')
    .replace(/\s*<link rel="icon"[^>]+>/, '')
    .replace(/\s*<link rel="apple-touch-icon"[^>]+>/, '')
    .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`)
    .replace(/\s*<script src="js\/content-loader\.js" defer><\/script>\s*<script src="js\/sim-engine\.js" defer><\/script>\s*<script src="js\/storage\.js" defer><\/script>\s*<script src="js\/app\.js" defer><\/script>/, () => `\n<script>window.__CRC_EMBEDDED_CONTENT__=${JSON.stringify(content)};window.__CRC_EMBEDDED_WORKER__=${JSON.stringify(embeddedWorker)};<\/script>\n${scripts.map((script) => `<script>\n${script}\n<\/script>`).join('\n')}`)
    .replace(/href="pages\/[^\"]+"/g, 'href="#" title="完整项目中提供该说明页面"')
    .replace(/href="icons\/[^\"]+"/g, 'href="#"')
    .replace(/content="\/icons\/icon-512\.png"/g, 'content=""');
  const output = path.join(root, 'crc-immune-frontier-v0.7.0-standalone.html');
  fs.writeFileSync(output, html);
  fs.copyFileSync(output, path.join(dist, 'standalone-demo.html'));
}

makeStandalone();

const checksums = [];
function walk(directory, prefix = '') {
  for (const name of fs.readdirSync(directory).sort()) {
    const full = path.join(directory, name);
    const relative = path.posix.join(prefix, name);
    if (fs.statSync(full).isDirectory()) walk(full, relative);
    else {
      const digest = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
      checksums.push(`${digest}  ${relative}`);
    }
  }
}
walk(dist);
fs.writeFileSync(path.join(root, 'checksums.txt'), `${checksums.join('\n')}\n`);
console.log(`Built ${checksums.length} deployable files in ${dist}.`);
