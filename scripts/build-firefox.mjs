import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';

const source = new URL('../extension/', import.meta.url);
const output = new URL('../dist/firefox/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', source), 'utf8'));
manifest.background = {page: 'firefox-background.html'};
manifest.browser_specific_settings = {
  gecko: {
    id: 'visor-movil@example.invalid',
    strict_min_version: '140.0',
    data_collection_permissions: {required: ['none']}
  }
};

await rm(output, {recursive: true, force: true});
await mkdir(new URL('../dist/', import.meta.url), {recursive: true});
await cp(source, output, {recursive: true});
await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(new URL('firefox-background.html', output),
  '<!doctype html><meta charset="utf-8"><script type="module" src="background.js"></script>\n');
