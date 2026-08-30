import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { affineTransformFromFileDirectory, rasterPixelToModel } from '../src/geo';
import { loadGeoTiffBand, readGeoInfo } from '../src/geoTiffLoader';
import { normalizePaletteStops, parseRgbTable } from '../src/palettes';

const palette = parseRgbTable(
  '0,0,0,255\n10,0,255,0\n100,255,0,0',
  'non-uniform',
);
assert.deepEqual(palette.stops.map((stop) => stop.position), [0, 0.1, 1]);
assert.deepEqual(
  normalizePaletteStops(palette.stops, true).map((stop) => stop.position),
  [0, 0.9, 1],
);
assert.deepEqual(
  normalizePaletteStops(palette.stops, true).map((stop) => stop.color),
  ['#ff0000', '#00ff00', '#0000ff'],
);

const matrixTransform = affineTransformFromFileDirectory({
  ModelTransformation: [2, 0.5, 0, 100, -0.25, -3, 0, 200, 0, 0, 1, 0, 0, 0, 0, 1],
});
assert.deepEqual(matrixTransform, [2, 0.5, 100, -0.25, -3, 200]);
assert.deepEqual(rasterPixelToModel(matrixTransform!, 4, 5, false), [110.5, 184]);
assert.deepEqual(rasterPixelToModel(matrixTransform!, 4, 5, true), [111.75, 182.375]);

const tiePointTransform = affineTransformFromFileDirectory({
  ModelTiepoint: [10, 20, 0, 500, 1000, 0],
  ModelPixelScale: [2, 3, 0],
});
assert.deepEqual(tiePointTransform, [2, 0, 480, 0, -3, 1060]);
assert.deepEqual(rasterPixelToModel(tiePointTransform!, 10, 20, false), [500, 1000]);

const projectedGeoInfo = readGeoInfo({
  fileDirectory: {
    ModelTiepoint: [0, 0, 0, -100, 100, 0],
    ModelPixelScale: [1, 1, 0],
  },
  getBoundingBox: () => [-100, -100, 100, 100],
  pixelIsArea: () => true,
  getGeoKeys: () => ({
    GTModelTypeGeoKey: 1,
    ProjectedCSTypeGeoKey: 3857,
    GeographicTypeGeoKey: 4326,
  }),
});
assert.equal(projectedGeoInfo.isGeographic, false);
assert.equal(projectedGeoInfo.epsg, 3857);
assert.equal(projectedGeoInfo.hasGeo, true);

const geographicGeoInfo = readGeoInfo({
  fileDirectory: {
    ModelTransformation: [0.1, 0.02, 0, -75, -0.01, -0.1, 0, 12, 0, 0, 1, 0, 0, 0, 0, 1],
  },
  getBoundingBox: () => [-75, 11, -74, 12],
  pixelIsArea: () => false,
  getGeoKeys: () => ({ GTModelTypeGeoKey: 2, GeographicTypeGeoKey: 4326 }),
});
assert.equal(geographicGeoInfo.isGeographic, true);
assert.deepEqual(geographicGeoInfo.transform, [0.1, 0.02, -75, -0.01, -0.1, 12]);

console.log('GeoRamp unit tests passed');

function findGeoTiffs(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return findGeoTiffs(candidate);
    return /\.tiff?$/i.test(entry.name) ? [candidate] : [];
  });
}

async function runSmokeTests(): Promise<void> {
  const directory = process.env.GEORAMP_SMOKE_DIR;
  if (!directory) return;
  const files = findGeoTiffs(directory);
  assert.ok(files.length > 0, `No GeoTIFF files found in ${directory}`);
  for (const file of files) {
    const raster = await loadGeoTiffBand(file, 0, 512);
    assert.ok(raster.width > 0 && raster.height > 0, `Invalid dimensions: ${file}`);
    assert.ok(raster.stats.validCount > 0, `No valid values: ${file}`);
    assert.ok(Number.isFinite(raster.stats.minimum), `Invalid minimum: ${file}`);
    assert.ok(Number.isFinite(raster.stats.maximum), `Invalid maximum: ${file}`);
  }
  console.log(`GeoRamp smoke-tested ${files.length} GeoTIFF files`);
}

void runSmokeTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
