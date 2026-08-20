import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifestPath = join(root, 'manifest.json');
const packagePath = join(root, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

if (manifest.version !== packageJson.version) {
    throw new Error(`Version mismatch: manifest=${manifest.version}, package=${packageJson.version}`);
}

const requiredFiles = new Set([
    manifest.background?.service_worker,
    manifest.options_page,
    manifest.side_panel?.default_path,
    ...(manifest.content_scripts || []).flatMap((entry) => entry.js || [])
].filter(Boolean));

for (const relativePath of requiredFiles) {
    if (!existsSync(join(root, relativePath))) {
        throw new Error(`Manifest references missing file: ${relativePath}`);
    }
}

const htmlFiles = readdirSync(root).filter((name) => name.endsWith('.html'));
for (const htmlFile of htmlFiles) {
    const html = readFileSync(join(root, htmlFile), 'utf8');
    const references = [...html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["']/gi)]
        .map((match) => match[1])
        .filter((value) => !/^(?:https?:|data:|#)/i.test(value));

    for (const reference of references) {
        if (!existsSync(join(root, reference))) {
            throw new Error(`${htmlFile} references missing file: ${reference}`);
        }
    }
}

const jsFiles = readdirSync(root).filter((name) => name.endsWith('.js'));
for (const jsFile of jsFiles) {
    const result = spawnSync(process.execPath, ['--check', jsFile], {
        cwd: root,
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        process.stderr.write(result.stderr || result.stdout);
        process.exit(result.status || 1);
    }
}

console.log(`Verified manifest ${manifest.version}, ${htmlFiles.length} HTML files, and ${jsFiles.length} JavaScript files.`);
