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
  previewData: Float32Array;
  sampleData: Float32Array;
}

const SAMPLE_GRID_SIZE = 512;
const PERCENTILE_BINS = 1024;

export async function loadGeoTiffBand(
  filePath: string,
  targetBand = 0,
  maxPreviewDimension = 1400,
  signal?: AbortSignal
): Promise<GeoTiffData> {
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
    const sampleResult = await readDeterministicSample(
      image, activeBand, width, height, signal
    );
    const sampleData = normalizeRaster(sampleResult, noDataValue);
    const rasterResult = await image.readRasters({
      samples: [activeBand],
      interleave: true,
      width: previewWidth,
      height: previewHeight,
      resampleMethod: 'nearest',
      signal,
    });
    const previewData = normalizeRaster(rasterResult as unknown as TypedArray, noDataValue);

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

async function readDeterministicSample(
  image: any,
  band: number,
  width: number,
  height: number,
  signal?: AbortSignal
): Promise<Float32Array> {
  const result = new Float32Array(SAMPLE_GRID_SIZE * SAMPLE_GRID_SIZE);
  const columns = Array.from(
    { length: SAMPLE_GRID_SIZE },
    (_, column) => Math.min(
      width - 1,
      Math.floor(((column + 0.5) * width) / SAMPLE_GRID_SIZE)
    )
  );
  let previousSourceRow = -1;
  let sourceValues: TypedArray | null = null;
  for (let row = 0; row < SAMPLE_GRID_SIZE; row++) {
    if (signal?.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new Error('Operación cancelada.');
    }
    const sourceRow = Math.min(
      height - 1,
      Math.floor(((row + 0.5) * height) / SAMPLE_GRID_SIZE)
    );
    if (sourceRow !== previousSourceRow) {
      sourceValues = await image.readRasters({
        samples: [band],
        interleave: true,
        window: [0, sourceRow, width, sourceRow + 1],
        signal,
      }) as unknown as TypedArray;
      previousSourceRow = sourceRow;
    }
    for (let column = 0; column < SAMPLE_GRID_SIZE; column++) {
      result[row * SAMPLE_GRID_SIZE + column] = Number(sourceValues![columns[column]]);
    }
  }
  return result;
}

function normalizeRaster(source: TypedArray, noDataValue: number | null): Float32Array {
  const result = new Float32Array(source.length);
  for (let index = 0; index < source.length; index++) {
    const value = Number(source[index]);
    result[index] = !Number.isFinite(value) || (noDataValue !== null && value === noDataValue)
      ? Number.NaN
      : value;
  }
  return result;
}

function calculateStats(data: Float32Array, noDataValue: number | null): BandStats {
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
    } else if (Number.isInteger(geographic) && geographic > 0 && geographic !== 32767) {
      epsg = geographic;
    }
    isGeographic = modelType === 2 || (
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
