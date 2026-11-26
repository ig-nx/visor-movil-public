import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chromium} from 'playwright';

test('popup con perfiles por vista: abre de una a cuatro ventanas nativas y una en pantalla completa', {timeout:45000}, async t => {
  const profile = await mkdtemp(join(tmpdir(),'visor-movil-'));
  t.after(() => rm(profile,{recursive:true,force:true}));
  const extension = fileURLToPath(new URL('../extension',import.meta.url));
  const server = createServer((_req,res) => {
    res.setHeader('Content-Security-Policy',"frame-ancestors 'none'");
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><title>Prueba</title><h1>Localhost sin iframes</h1>');
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/demo?orden=fecha#lista`;
  const browser = await chromium.launchPersistentContext(profile,{
    channel:'chromium',headless:!process.env.VISOR_HEADED,viewport:null,
    args:['--disable-extensions-except='+extension,'--load-extension='+extension]
  });

  try {
    const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
    const popupUrl = new URL('popup.html',worker.url()).href;
    assert.equal(await worker.evaluate(() => chrome.action.getPopup({})),popupUrl);
    assert.equal(await worker.evaluate(() => typeof chrome.debugger),'undefined');
    const original = await browser.newPage();
    await original.goto(url);

    async function openMenu(activeUrl = url) {
      const page = await browser.newPage();
      await page.addInitScript(active => {
        if (location.pathname === '/popup.html') chrome.tabs.query = async () => [{url:active}];
      },activeUrl);
      await page.goto(popupUrl);
      await page.waitForFunction(() => document.querySelector('#source').textContent !== 'Leyendo pestaña…');
      return page;
    }

    async function launch(menu,count,widths,fullscreen = false) {
      const originalPages = new Set(browser.pages());
      const first = browser.waitForEvent('page',{timeout:8000}).then(async () => {
        // Reproduce the action popup disappearing as the first window takes focus.
        if (!menu.isClosed()) await menu.close();
      });
      await menu.getByRole('button',{name:fullscreen ? 'Abrir en pantalla completa' : 'Abrir en ventanas',exact:true}).click();
      await first;
      const created = () => browser.pages().filter(page => !originalPages.has(page));
      while (created().length < count) await browser.waitForEvent('page',{timeout:8000});
      const windows = created();
      assert.equal(windows.length,count);
      for (const popup of windows) {
        await popup.waitForURL(url);
        assert.equal(popup.frames().length,1);
        await popup.getByRole('heading',{name:'Localhost sin iframes'}).waitFor();
      }
      const native = await worker.evaluate(() => chrome.windows.getAll({windowTypes:['popup']}));
      assert.equal(native.length,count);
      if (fullscreen) {
        assert.equal(native[0].state,'fullscreen');
      } else if (process.env.VISOR_HEADED) {
        assert.deepEqual(native.map(win => win.width).sort((a,b)=>a-b),widths);
        if (count === 4) assert.equal(new Set(native.map(win => win.top)).size,2);
      }
      assert.equal(original.url(),url);
      await Promise.all(windows.map(popup => popup.close()));
    }

    const menu = await openMenu();
    assert.equal(await menu.locator('#source').getAttribute('title'),url);
    assert.equal(await menu.getByRole('button',{name:'3 vistas'}).getAttribute('aria-pressed'),'true');
    const values = page => page.locator('#devices select:visible').evaluateAll(nodes => nodes.map(node => node.value));
    assert.deepEqual(await values(menu),['phone-360','phone-414','ipad-mini']);
    assert.equal(await menu.getByRole('button',{name:'Abrir en panel'}).count(),0);
    assert.equal(await menu.getByRole('button',{name:'Abrir juntas'}).count(),0);
    assert.deepEqual(await menu.locator('select').first().locator('optgroup').evaluateAll(groups => groups.map(group => group.label)),['Teléfonos','Tablets']);
    assert.equal(await worker.evaluate(() => chrome.windows.getAll({windowTypes:['popup']})).then(windows => windows.length),0);
    await launch(menu,3,[376,430,784]);

    const one = await openMenu();
    await one.getByRole('button',{name:'1 vista',exact:true}).click();
    await one.getByRole('combobox',{name:'Modelo de la vista 1'}).selectOption('iphone-15-max');
    assert.deepEqual(await values(one),['iphone-15-max']);
    await launch(one,1,[446]);

    const two = await openMenu();
    assert.deepEqual(await values(two),['iphone-15-max']);
    assert.equal(await two.locator('#devices select').nth(1).locator('option').count(),0);
    assert.equal(await two.locator('#devices select').nth(2).locator('option').count(),0);
    await two.getByRole('button',{name:'2 vistas',exact:true}).click();
    await two.getByRole('combobox',{name:'Modelo de la vista 2'}).selectOption('ipad-7');
    assert.deepEqual(await values(two),['iphone-15-max','ipad-7']);
    await launch(two,2,[446,826]);

    const four = await openMenu();
    await four.getByRole('button',{name:'4 vistas'}).click();
    assert.deepEqual(await values(four),['iphone-15-max','ipad-7','ipad-mini','phone-393']);
    await four.getByRole('combobox',{name:'Modelo de la vista 2'}).selectOption('phone-414');
    await four.getByRole('combobox',{name:'Modelo de la vista 1'}).selectOption('phone-360');

    await launch(four,4,[376,409,430,784]);

    const full = await openMenu();
    await full.getByRole('button',{name:'1 vista',exact:true}).click();
    await full.getByLabel('Pantalla completa (sin marco)').check();
    assert.equal((await values(full)).length,0);
    await launch(full,1,[],true);

    if (process.env.VISOR_POPUP_SCREENSHOT) {
      const sample = await openMenu('https://example.com/demo');
      await sample.getByRole('button',{name:'3 vistas'}).click();
      await sample.locator('body').screenshot({path:process.env.VISOR_POPUP_SCREENSHOT});
      await sample.close();
    }
    const restricted = await openMenu('brave://extensions');
    assert.equal(await restricted.getByRole('button',{name:'Abrir en ventanas'}).isDisabled(),true);
    await restricted.close();
  } finally {
    await browser.close();
  }
});
