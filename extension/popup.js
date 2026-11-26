import {devices, normalizeSetup, webUrl} from './core.mjs';

const api = globalThis.browser ?? globalThis.chrome;

const $ = id => document.getElementById(id);
const buttons = [...document.querySelectorAll('[data-count]')];
const selectors = [...document.querySelectorAll('#devices select')];
const windows = $('windows');
const fullscreen = $('fullscreen');
const status = $('status');
const key = 'window-setup';
let saved;
try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
const setup = normalizeSetup(saved);
let source = null;

function save() {
  try { localStorage.setItem(key,JSON.stringify(setup)); } catch {}
}
let options;
function fill(select,i) {
  if (select.options.length) return;
  if (!options) {
    options = document.createDocumentFragment();
    const phones = document.createElement('optgroup');
    const tablets = document.createElement('optgroup');
    phones.label = 'Teléfonos';
    tablets.label = 'Tablets';
    for (const [id,{name,width,height,tablet}] of Object.entries(devices)) {
      (tablet ? tablets : phones).append(new Option(`${name} · ${width} × ${height}`,id));
    }
    options.append(phones,tablets);
  }
  select.append(options.cloneNode(true));
  select.value = setup.models[i];
}
function renderCount() {
  if (setup.count !== 1) fullscreen.checked = false;
  $('fullscreen-option').hidden = setup.count !== 1;
  windows.textContent = fullscreen.checked ? 'Abrir en pantalla completa' : 'Abrir en ventanas';
  buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.count) === setup.count)));
  selectors.forEach((select,i) => {
    const hidden = i >= setup.count || fullscreen.checked;
    select.parentElement.hidden = hidden;
    if (!hidden) fill(select,i);
  });
}
$('devices').addEventListener('change', event => {
  const i = selectors.indexOf(event.target);
  if (i < 0) return;
  setup.models[i] = event.target.value;
  save();
});
buttons.forEach(button => button.addEventListener('click', () => {
  setup.count = Number(button.dataset.count);
  renderCount();
  save();
}));
fullscreen.addEventListener('change',renderCount);
renderCount();

try {
  const [tab] = await api.tabs.query({active:true,currentWindow:true});
  source = webUrl(tab?.url);
} catch {}
$('source').textContent = source || 'Abre una página web para usar Visor Móvil.';
$('source').title = source || '';
windows.disabled = !source;

$('setup').addEventListener('submit', async event => {
  event.preventDefault();
  if (!source || windows.disabled) return;
  windows.disabled = true;
  status.hidden = true;
  const models = setup.models.slice(0,setup.count);
  const area = {left:screen.availLeft ?? 0,top:screen.availTop ?? 0,width:screen.availWidth,height:screen.availHeight};
  try {
    const {opened} = await api.runtime.sendMessage({type:'popup-windows',source,models,area,fullscreen:fullscreen.checked});
    if (opened === models.length) return window.close();
    status.textContent = `Se abrieron ${opened} de ${models.length} ventanas.`;
  } catch {
    status.textContent = 'No se pudieron abrir las ventanas.';
  }
  status.hidden = false;
  windows.disabled = false;
});
