/** QGIS single-band pseudocolor exchange. Keep these functions self-contained for the webview. */
export interface RampStyle {
  band: number; minimum: number; maximum: number;
  mode: 'continuous' | 'discrete'; values: number[]; colours: number[][];
}

export function parseQml(text: string, Parser: typeof DOMParser): RampStyle {
  // Never resolve entities or accept unrelated renderer types silently.
  if (/<!ENTITY/i.test(text)) throw new Error('QML: XML entities are unsupported.');
  const doc = new Parser().parseFromString(text, 'application/xml');
  const renderer = doc.querySelector('rasterrenderer');
  const shader = renderer?.querySelector('colorrampshader');
  if (doc.querySelector('parsererror') || renderer?.getAttribute('type') !== 'singlebandpseudocolor' || !shader)
    throw new Error('QML: singlebandpseudocolor required.');
  const kind = shader.getAttribute('colorRampType');
  if (!['INTERPOLATED', 'DISCRETE'].includes(kind || '') || shader.getAttribute('clip') === '1')
    throw new Error('QML: use an interpolated or discrete ramp without clipping.');
  if (Number(renderer.getAttribute('alphaBand') ?? -1) >= 0 || Number(renderer.getAttribute('opacity') ?? 1) !== 1 || renderer.querySelector('rasterTransparency *'))
    throw new Error('QML: custom transparency is unsupported.');
  const band = Number(renderer.getAttribute('band')) - 1;
  const minimum = Number(renderer.getAttribute('classificationMin'));
  const maximum = Number(renderer.getAttribute('classificationMax'));
  const items = [...shader.querySelectorAll('item')];
  if (!Number.isInteger(band) || band < 0 || !Number.isFinite(minimum) || !Number.isFinite(maximum)
      || !renderer.hasAttribute('classificationMin') || !renderer.hasAttribute('classificationMax')
      || maximum <= minimum || items.length < 2 || items.length > 256)
    throw new Error('QML: invalid band, limits or colour table.');
  const values: number[] = [], colours: number[][] = [];
  items.forEach((item, index) => {
    const raw = item.getAttribute('value') || '';
    const value = /^(inf|infinity)$/i.test(raw) ? Infinity : raw.trim() ? Number(raw) : NaN;
    const hex = item.getAttribute('color') || '';
    if ((!Number.isFinite(value) && !(kind === 'DISCRETE' && index === items.length - 1 && value === Infinity))
        || !/^#[0-9a-f]{6}$/i.test(hex) || Number(item.getAttribute('alpha') ?? 255) !== 255
        || (index > 0 && value < values[index - 1]))
      throw new Error('QML: invalid stops or unsupported transparency.');
    values.push(value);
    colours.push([1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)));
  });
  if (kind === 'DISCRETE' && values[values.length - 1] !== Infinity)
    throw new Error('QML: the final discrete class must extend to infinity.');
  // The viewer saturates the final discrete class just like GeoRamp in QGIS.
  if (kind === 'DISCRETE') values[values.length - 1] = Math.max(maximum, values[values.length - 2]);
  return { band, minimum, maximum, mode: kind === 'DISCRETE' ? 'discrete' : 'continuous', values, colours };
}

export function exportQml(style: RampStyle, compactLegend = true): string {
  const {band, minimum, maximum, mode, values, colours} = style;
  if (!Number.isInteger(band) || band < 0 || !Number.isFinite(minimum) || !Number.isFinite(maximum)
      || !['continuous', 'discrete'].includes(mode) || values.length > 256
      || maximum <= minimum || values.length < 2 || values.length !== colours.length
      || !values.every((v, i) => Number.isFinite(v) && (i === 0 || v >= values[i - 1])) || !colours.every(c => c.length === 3 && c.every(v => Number.isInteger(v) && v >= 0 && v <= 255)))
    throw new Error('Invalid style');
  const items = values.map((value, index) => {
    const hex = '#' + colours[index].map(v => v.toString(16).padStart(2, '0')).join('');
    return '<item value="' + (mode === 'discrete' && index === values.length - 1 ? 'inf' : value)
      + '" color="' + hex + '" alpha="255" label="' + value + '"/>';
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<qgis version="3.34" styleCategories="Symbology">\n'
    + '<pipe><rasterrenderer type="singlebandpseudocolor" band="' + (band + 1) + '" opacity="1" alphaBand="-1" classificationMin="'
    + minimum + '" classificationMax="' + maximum + '"><rastershader><colorrampshader minimumValue="'
    + minimum + '" maximumValue="' + maximum + '" colorRampType="' + (mode === 'discrete' ? 'DISCRETE' : 'INTERPOLATED')
    + '" classificationMode="1" clip="0">\n' + items
    + '\n<legendSettings useContinuousLegend="' + (compactLegend ? 1 : 0) + '" minimumLabel="' + minimum
    + '" maximumLabel="' + maximum + '"/></colorrampshader></rastershader></rasterrenderer></pipe></qgis>';
}

export function histogramSummary(samples: ArrayLike<number>, counts: number[], minimum: number, maximum: number,
    mean: number, stddev: number, sigma: number) {
  const sorted = Array.from(samples).filter(Number.isFinite).sort((a, b) => a - b);
  const n = sorted.length, middle = Math.floor(n / 2);
  const median = n ? (n % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : NaN;
  const peak = Math.max(...counts, 0);
  const modes = counts.flatMap((count, i) => peak > 0 && count === peak ? [minimum + (i + 0.5) * (maximum - minimum) / counts.length] : []);
  const low = mean - sigma * stddev, high = mean + sigma * stddev;
  const inside = sorted.reduce((total, value) => total + Number(value >= low && value <= high), 0);
  return {median, modes, low, high, inside, total:n, inRange:counts.reduce((a, b) => a + b, 0)};
}
