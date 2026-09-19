import { fromFile, type TypedArray } from 'geotiff';
import { affineTransformFromFileDirectory, type AffineTransform } from './geo';

export interface BandStats {
  minimum: number;
  maximum: number;
  mean: number;
  stddev: number;
  validCount: number;
  noDataValue: number | null;
  percentileCounts: number[];
}

export interface GeoSpatialInfo {
  crs: string;
  epsg: number | null;
  bbox: [number, number, number, number] | null;
  transform: AffineTransform | null;
  pixelIsArea: boolean;
  isGeographic: boolean;
  hasGeo: boolean;
}

export interface GeoTiffData {
  width: number;
  height: number;
  bandCount: number;
  activeBand: number;
  stats: BandStats;
  geo: GeoSpatialInfo;
  previewWidth: number;
  previewHeight: number;
  previewData: Float64Array;
  sampleData: Float64Array;
}

const PERCENTILE_BINS = 1024;

export async function loadGeoTiffBand(
  filePath: string,
  targetBand = 0,
  maxPreviewDimension = 1400,
  signal?: AbortSignal
): Promise<GeoTiffData> {
  signal?.throwIfAborted();
  const tiff = await fromFile(filePath, signal);
  try {
    const image = await tiff.getImage(0);
    const width = image.getWidth();
    const height = image.getHeight();
    const bandCount = image.getSamplesPerPixel();
    if (!width || !height || !bandCount) {
      throw new Error('El TIFF no contiene una imagen ráster válida.');
    }

    const activeBand = Math.min(Math.max(0, targetBand), bandCount - 1);
    const scale = Math.max(1, width / maxPreviewDimension, height / maxPreviewDimension);
    const previewWidth = Math.max(1, Math.round(width / scale));
    const previewHeight = Math.max(1, Math.round(height / scale));
    const rawNoData = image.getGDALNoData();
    const noDataValue = rawNoData !== null && rawNoData !== undefined && Number.isFinite(Number(rawNoData))
      ? Number(rawNoData)
      : null;
    // File-level reads select internal overviews when available.
    const rasterResult = await readOverview(tiff, image, {
      samples: [activeBand], interleave: true,
      width: previewWidth, height: previewHeight,
      resampleMethod: 'nearest', signal,
    });
    const previewData = normalizeRaster(rasterResult as unknown as TypedArray, noDataValue);
    const sampleData = previewData;

    return {
      width,
      height,
      bandCount,
      activeBand,
      stats: calculateStats(sampleData, noDataValue),
      geo: readGeoInfo(image),
      previewWidth,
      previewHeight,
      previewData,
      sampleData,
    };
  } finally {
    await tiff.close();
  }
}

function normalizeRaster(source: TypedArray, noDataValue: number | null): Float64Array {
  const result = new Float64Array(source.length);
  for (let index = 0; index < source.length; index++) {
    const value = Number(source[index]);
    result[index] = !Number.isFinite(value) || (noDataValue !== null && value === noDataValue)
      ? Number.NaN
      : value;
  }
  return result;
}

function calculateStats(data: Float64Array, noDataValue: number | null): BandStats {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let mean = 0;
  let m2 = 0;
  let validCount = 0;

  for (let index = 0; index < data.length; index++) {
    const value = data[index];
    if (!Number.isFinite(value)) continue;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
    validCount++;
    const delta = value - mean;
    mean += delta / validCount;
    m2 += delta * (value - mean);
  }
  if (!validCount) {
    throw new Error('La banda no contiene valores válidos después de excluir NoData.');
  }

  const stddev = validCount > 1 ? Math.sqrt(m2 / (validCount - 1)) : 0;
  const percentileCounts = new Array<number>(PERCENTILE_BINS).fill(0);
  const range = maximum - minimum;
  for (let index = 0; index < data.length; index++) {
    const value = data[index];
    if (!Number.isFinite(value)) continue;
    const bin = range > 0
      ? Math.min(PERCENTILE_BINS - 1, Math.floor(((value - minimum) / range) * PERCENTILE_BINS))
      : 0;
    percentileCounts[bin]++;
  }
  return { minimum, maximum, mean, stddev, validCount, noDataValue, percentileCounts };
}

export function readGeoInfo(image: any): GeoSpatialInfo {
  let bbox: [number, number, number, number] | null = null;
  try {
    const candidate = image.getBoundingBox();
    if (candidate?.length >= 4 && candidate.every((value: unknown) => Number.isFinite(Number(value)))) {
      bbox = [Number(candidate[0]), Number(candidate[1]), Number(candidate[2]), Number(candidate[3])];
    }
  } catch {
    bbox = null;
  }

  const transform = affineTransformFromFileDirectory(image.fileDirectory);
  let pixelIsArea = true;
  try {
    pixelIsArea = Boolean(image.pixelIsArea());
  } catch {
    pixelIsArea = true;
  }

  let epsg: number | null = null;
  let crs = 'Sin CRS';
  let isGeographic = false;
  try {
    const keys = image.getGeoKeys();
    const projected = Number(keys?.ProjectedCSTypeGeoKey);
    const geographic = Number(keys?.GeographicTypeGeoKey);
    const modelType = Number(keys?.GTModelTypeGeoKey);
    if (Number.isInteger(projected) && projected > 0 && projected !== 32767) {
      epsg = projected;
    } else if (modelType !== 1 && Number.isInteger(geographic) && geographic > 0 && geographic !== 32767) {
      epsg = geographic;
    }
    isGeographic = modelType === 2 || (modelType !== 1 &&
      !(Number.isInteger(projected) && projected > 0 && projected !== 32767)
      && Number.isInteger(geographic) && geographic > 0
    );
    if (epsg !== null) crs = `EPSG:${epsg}`;
  } catch {
    crs = 'Sin CRS';
  }
  return {
    crs,
    epsg,
    bbox,
    transform,
    pixelIsArea,
    isGeographic,
    hasGeo: bbox !== null && transform !== null,
  };
}

/** Bounded source-window read. Pixel probes always use the original IFD. */
export async function readGeoTiffWindow(
  filePath: string, band: number, window: number[], outputWidth: number,
  outputHeight: number, signal?: AbortSignal,
): Promise<{ data: Float64Array; width: number; height: number; window: number[] }> {
  signal?.throwIfAborted();
  const tiff = await fromFile(filePath, signal);
  try {
    const image = await tiff.getImage(0);
    if (!Number.isInteger(band) || band < 0 || band >= image.getSamplesPerPixel()
      || window.length !== 4 || !window.every(Number.isInteger)
      || window[0] < 0 || window[1] < 0 || window[2] > image.getWidth()
      || window[3] > image.getHeight() || window[2] <= window[0] || window[3] <= window[1]) {
      throw new Error('Invalid raster window');
    }
    const width = Math.min(2048, window[2] - window[0], Math.max(1, Math.ceil(outputWidth)));
    const height = Math.min(2048, window[3] - window[1], Math.max(1, Math.ceil(outputHeight)));
    if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error('Invalid output size');
    const options = { samples: [band], interleave: true as const, window, width, height,
      resampleMethod: 'nearest', signal };
    // Source windows retain exact pixel alignment, including rotated rasters.
    const raw = await image.readRasters(options);
    signal?.throwIfAborted();
    return { data: normalizeRaster(raw as unknown as TypedArray, image.getGDALNoData()),
      width, height, window };
  } finally { await tiff.close(); }
}

// Choose an overview in pixel space: also works for plain and rotated TIFFs.
async function readOverview(tiff: any, original: any, options: any): Promise<TypedArray> {
  const window = options.window ?? [0, 0, original.getWidth(), original.getHeight()];
  let selected = original;
  const count = await tiff.getImageCount();
  for (let index = 1; index < count; index++) {
    const candidate = await tiff.getImage(index);
    const directory = candidate.fileDirectory;
    if (!(directory.NewSubfileType & 1) && directory.SubfileType !== 2) continue;
    const sx = candidate.getWidth() / original.getWidth();
    const sy = candidate.getHeight() / original.getHeight();
    if (candidate.getSamplesPerPixel() !== original.getSamplesPerPixel()
      || Math.abs(sx - sy) > 1 / Math.min(original.getWidth(), original.getHeight())) continue;
    if ((window[2]-window[0])*sx >= options.width && (window[3]-window[1])*sy >= options.height
      && candidate.getWidth() < selected.getWidth()) selected = candidate;
  }
  const sx = selected.getWidth()/original.getWidth(), sy = selected.getHeight()/original.getHeight();
  return selected.readRasters({...options, window:[Math.floor(window[0]*sx), Math.floor(window[1]*sy),
    Math.ceil(window[2]*sx), Math.ceil(window[3]*sy)]});
}
