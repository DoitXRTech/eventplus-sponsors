// Contraste de colores de marca (formula de WCAG 2). Cada organizacion elige sus colores
// libremente; de aca salen las variantes que se pueden leer: que texto va encima de cada
// color (blanco u oscuro) y que version del color se usa como texto sobre fondos claros.

export const DARK = '#0F1419';
export const LIGHT = '#FFFFFF';
const SURFACE = '#F5F2EC'; // fondo crema de la app (las tarjetas son blancas, mas faciles)

export const isHex = (v) => typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

const rgb = (hex) => {
  let h = hex.trim().slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const luminance = (color) => {
  const [r, g, b] = rgb(color).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// a mezclado con b en proporcion w (0 = a, 1 = b).
export const mix = (a, b, w) => { const [x, y] = [rgb(a), rgb(b)]; return hex(x.map((v, i) => v + (y[i] - v) * w)); };

// Texto que va encima de un fondo de este color: el que mas contraste tenga.
export const onColor = (bg) => (contrast(bg, LIGHT) >= contrast(bg, DARK) ? LIGHT : DARK);
export const isLight = (bg) => onColor(bg) === DARK;

// El color usado como texto sobre fondos claros: se oscurece (hacia DARK) solo lo necesario
// para llegar a 4.5:1, asi conserva el tono de la marca; uno muy claro termina casi negro.
export function readableText(color, bg = SURFACE, min = 4.5) {
  for (let i = 0; i <= 20; i++) {
    const c = mix(color, DARK, i / 20);
    if (contrast(c, bg) >= min) return c;
  }
  return DARK;
}

// Fondo apenas distinto del color de marca (item activo o con hover en la sidebar) que no
// le baje el contraste al texto de encima: se corre hacia el color del texto, y si eso lo
// deja por debajo de 4.5:1 (marca de tono medio), hacia el lado contrario.
export function shadeOn(bg, w) {
  const fg = onColor(bg);
  const toward = mix(bg, fg, w);
  return contrast(toward, fg) >= 4.5 ? toward : mix(bg, fg === DARK ? LIGHT : DARK, w);
}

// Texto secundario sobre un fondo de marca: el texto principal atenuado hacia el fondo,
// sin bajar de 4.5:1.
export function mutedOn(bg) {
  const fg = onColor(bg);
  for (let i = 8; i >= 0; i--) {
    const c = mix(fg, bg, i / 20);
    if (contrast(c, bg) >= 4.5) return c;
  }
  return fg;
}
