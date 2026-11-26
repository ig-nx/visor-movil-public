import {devices, isDevice, webUrl, windowBounds} from './core.mjs';

const api = globalThis.browser ?? globalThis.chrome;

// Opening a native window steals focus and destroys the browser-action popup.
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'popup-windows' || sender.url !== api.runtime.getURL('popup.html')) return;
  const {models, area, fullscreen} = message;
  const source = webUrl(message.source);
  if (!source || !Array.isArray(models) || models.length < 1 || models.length > 4 || !models.every(isDevice) ||
      !area || !['top','left','width','height'].every(key => Number.isInteger(area[key])) ||
      area.width < 1 || area.height < 1) return;

  if (fullscreen === true) {
    if (models.length !== 1) return;
    void api.windows.create({url:source,type:'popup',state:'fullscreen'}).then(
      () => respond({opened:1}), () => respond({opened:0})
    );
    return true;
  }

  void (async () => {
    let opened = 0;
    for (const {left,top,width,height} of windowBounds(models.map(id => devices[id]), area)) {
      const options = {width,height,url:source,type:'popup'};
      try { await api.windows.create({...options,left,top}); }
      catch {
        try { await api.windows.create(options); }
        catch { break; }
      }
      opened++;
    }
    respond({opened});
  })();
  return true;
});
