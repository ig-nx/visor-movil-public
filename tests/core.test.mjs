import {readdir, stat, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {devices, isDevice, normalizeSetup, webUrl, windowBounds} from '../extension/core.mjs';

test('conserva la URL exacta de localhost y de sitios públicos', () => {
  for (const url of ['http://localhost:3000/demo?orden=fecha#lista', 'https://example.com/demo'])
    assert.equal(webUrl(url), url);
});

test('solo abre HTTP/HTTPS sin credenciales', () => {
  for (const url of ['brave://extensions','file:///foo','javascript:alert(1)','https://user:pass@example.com',null])
    assert.equal(webUrl(url), null);
});

test('tres vistas de fábrica: dos teléfonos y una tablet; opciones inválidas no se conservan', () => {
  const initial = normalizeSetup();
  assert.deepEqual(initial,{catalog:1,count:3,models:['phone-360','phone-414','ipad-mini','phone-393']});
  assert.deepEqual(initial.models.map(id => devices[id].width),[360,414,768,393]);
  assert.deepEqual(normalizeSetup({count:8,models:['toString','iphone-13',null]}),
    {catalog:1,count:3,models:['phone-360','iphone-13','ipad-mini','phone-393']});
  assert.equal(normalizeSetup({count:1,models:['ipad-7']}).models[0],'ipad-7');
  assert.equal(isDevice('__proto__'),false);
  assert.deepEqual(normalizeSetup({count:2,models:['iphone-se','pixel-7','ipad-mini']}),
    {...initial,count:2});
  assert.deepEqual(normalizeSetup({catalog:1,count:3,models:['iphone-se','pixel-7','ipad-mini']}).models,
    ['iphone-se','pixel-7','ipad-mini','phone-393']);
  assert.deepEqual(['phone-384','phone-393','tablet-820'].map(id => [devices[id].width,devices[id].height]),
    [[384,832],[393,873],[820,1180]]);
});

test('calcula tres ventanas distintas y las mantiene dentro del área', () => {
  const sizes = normalizeSetup().models.slice(0,3).map(id => devices[id]);
  const wide = {left:-1920,top:24,width:1920,height:1080};
  const boxes = windowBounds(sizes,wide);
  assert.deepEqual(boxes.map(box => box.width),[376,430,784]);
  assert.deepEqual(boxes.map(box => box.height),[856,952,1080]);
  for (const [i,box] of boxes.entries()) {
    assert.equal(box.top,24);
    assert.ok(box.left >= -1920 && box.left+box.width <= 0);
    if (i) assert.ok(boxes[i-1].left+boxes[i-1].width < box.left);
  }
  assert.ok(windowBounds(sizes,{left:0,top:0,width:600,height:700})
    .every(({left,width,height}) => left >= 0 && left+width <= 600 && height <= 700));
});

test('cuatro vistas en fila si caben, o mosaico 2 × 2 sin reducir los anchos', () => {
  const setup = normalizeSetup({count:4});
  assert.equal(setup.count,4);
  const sizes = setup.models.map(id => devices[id]);
  const a = {left:-1920,top:24,width:1920,height:1080};
  const tiled = windowBounds(sizes,a);
  assert.deepEqual(tiled.map(box => box.width),[376,430,784,409]);
  assert.deepEqual(tiled.map(box => box.top),[24,24,569,569]);
  assert.ok(tiled.every(box => box.height <= 535 && box.top+box.height <= 1104));
  const wide = windowBounds(sizes,{...a,width:2560});
  assert.ok(wide.every(box => box.top === 24));
  assert.ok(wide.every((box,i) => i === 0 || wide[i-1].left+wide[i-1].width < box.left));
});

test('sin permiso debugger, sin panel, sin dependencias y bajo 14 KiB', async () => {
  const root = new URL('../extension/',import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  assert.deepEqual(manifest.permissions,['activeTab']);
  const files = (await readdir(root,{recursive:true,withFileTypes:true})).filter(entry => entry.isFile());
  assert.ok(!files.some(file => /^(workspace|live|demo|board)\./.test(file.name)));
  const sizes = await Promise.all(files.map(entry => stat(join(entry.parentPath,entry.name))));
  const bytes = sizes.reduce((total,entry) => total+entry.size,0);
  assert.ok(bytes < 14*1024,`Extensión: ${bytes} bytes`);
  const pkg = JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.deepEqual(pkg.dependencies ?? {},{});
});
