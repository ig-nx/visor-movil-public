// Logical portrait dimensions; these are window presets, not mobile emulation.
export const devices = Object.freeze({
  'phone-360': {name:'Teléfono compacto', width:360, height:800},
  'phone-414': {name:'Teléfono grande', width:414, height:896},
  'phone-384': {name:'Teléfono medio', width:384, height:832},
  'phone-393': {name:'Teléfono alto', width:393, height:873},
  'iphone-se': {name:'iPhone SE (1ª gen.)', width:320, height:568},
  'iphone-13': {name:'iPhone 13', width:390, height:844},
  'pixel-7': {name:'Google Pixel 7', width:412, height:915},
  'iphone-15-max': {name:'iPhone 15 Pro Max', width:430, height:932},
  'ipad-mini': {name:'iPad mini', width:768, height:1024, tablet:true},
  'ipad-7': {name:'iPad (7ª gen.)', width:810, height:1080, tablet:true},
  'tablet-820': {name:'Tablet 820', width:820, height:1180, tablet:true}
});

const defaults = ['phone-360','phone-414','ipad-mini','phone-393'];
const oldDefaults = ['iphone-se','pixel-7','ipad-mini'];
export const isDevice = id => typeof id === 'string' && Object.hasOwn(devices,id);

export function normalizeSetup(saved) {
  const models = !saved?.catalog && oldDefaults.every((id,i) => saved?.models?.[i] === id)
    ? defaults : saved?.models;
  return {
    catalog: 1,
    count: [1,2,3,4].includes(saved?.count) ? saved.count : 3,
    models: defaults.map((fallback,i) => isDevice(models?.[i]) ? models[i] : fallback)
  };
}

export function webUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function windowBounds(sizes, area) {
  const gap = 10;
  const windows = sizes.map(({width, height}) => ({
    width: Math.min(area.width, width + 16),
    height: Math.min(area.height, height + 56)
  }));
  const rowWidth = row => row.reduce((n,box) => n+box.width+gap,-gap);
  const tiled = windows.length === 4 && area.height >= 440 && rowWidth(windows) > area.width;
  const rows = tiled ? [windows.slice(0,2), windows.slice(2)] : [windows];
  const maxHeight = tiled ? Math.max(1,Math.floor((area.height-gap)/2)) : area.height;
  return rows.flatMap((row,r) => {
    const total = rowWidth(row);
    let left = area.left + Math.max(0,Math.floor((area.width-total)/2));
    return row.map(({width,height},i) => {
      const x = total <= area.width ? left
        : area.left + Math.round((area.width-width)*i/Math.max(1,row.length-1));
      left += width + gap;
      return {width,height:Math.min(height,maxHeight),left:x,top:area.top+r*(maxHeight+gap)};
    });
  });
}
