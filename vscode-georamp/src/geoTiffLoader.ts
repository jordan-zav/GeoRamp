import * as geotiff from 'geotiff';
import * as fs from 'fs';

export interface BandStats {
  minimum: number;
  maximum: number;
  mean: number;
  stddev: number;
  validCount: number;
  noDataValue: number | null;
  percentileCounts: number[]; // 1024 bins over data_minimum..data_maximum
}

export interface GeoSpatialInfo {
  crs: string;
  epsg: number | null;
  bbox: [number, number, number, number] | null; // [minX, minY, maxX, maxY]
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
}

export async function loadGeoTiffBand(
  filePath: string,
  targetBand = 0
): Promise<GeoTiffData> {
  const fileBuffer = fs.readFileSync(filePath);
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );

  const tiff = await geotiff.fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage(0);
  const width = image.getWidth();
  const height = image.getHeight();
  const samplesPerPixel = image.getSamplesPerPixel();

  const bandIndex = Math.min(Math.max(0, targetBand), samplesPerPixel - 1);
  const rawRasters = await image.readRasters({ samples: [bandIndex], interleave: false });
  const rawData = rawRasters[0] as TypedArray;

  let noDataValue = image.getGDALNoData();
  if (noDataValue === null || noDataValue === undefined) {
    noDataValue = null;
  }

  // Extract Geospatial Metadata (Bounding Box & CRS)
  let bbox: [number, number, number, number] | null = null;
  let crs = 'No especificado / Sin CRS';
  let epsg: number | null = null;
  let hasGeo = false;

  try {
    const rawBbox = image.getBoundingBox();
    if (rawBbox && rawBbox.length >= 4 && Number.isFinite(rawBbox[0])) {
      bbox = [rawBbox[0], rawBbox[1], rawBbox[2], rawBbox[3]];
      hasGeo = true;
    }
  } catch (e) {
    bbox = null;
  }

  try {
    const geoKeys = image.getGeoKeys();
    if (geoKeys) {
      if (geoKeys.ProjectedCSTypeGeoKey && geoKeys.ProjectedCSTypeGeoKey !== 32767) {
        epsg = geoKeys.ProjectedCSTypeGeoKey;
        crs = `EPSG:${epsg}`;
        if (geoKeys.ProjectedCitationGeoKey) {
          crs += ` (${geoKeys.ProjectedCitationGeoKey})`;
        }
      } else if (geoKeys.GeographicTypeGeoKey && geoKeys.GeographicTypeGeoKey !== 32767) {
        epsg = geoKeys.GeographicTypeGeoKey;
        crs = `EPSG:${epsg}`;
        if (geoKeys.GeogCitationGeoKey) {
          crs += ` (${geoKeys.GeogCitationGeoKey})`;
        }
      }
    }
  } catch (e) {
    crs = 'Sin metadatos CRS';
  }

  const isNoData = (val: number): boolean => {
    if (!Number.isFinite(val)) return true;
    if (noDataValue !== null && Number.isFinite(noDataValue)) {
      if (val === noDataValue) return true;
      if (Math.abs(val - noDataValue) < 1e-4) return true;
      if (Math.abs(noDataValue) > 1e4 && Math.abs(val - noDataValue) / Math.abs(noDataValue) < 1e-4) return true;
    }
    // Filter sentinel GIS NoData values
    if (Math.abs(val) > 1e30 || val === -9999 || val === -99999 || val === -999999) return true;
    return false;
  };

  const rasterData = new Float32Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    const val = rawData[i];
    rasterData[i] = isNoData(val) ? NaN : val;
  }

  // Matches QGIS SAMPLE_SIZE = 250000 for provider.bandStatistics
  const SAMPLE_SIZE = 250000;
  const totalPixels = width * height;
  const sampleStep = Math.max(1, Math.floor(Math.sqrt(totalPixels / SAMPLE_SIZE)));

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let validCount = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const idx = y * width + x;
      const val = rasterData[idx];
      if (Number.isFinite(val)) {
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;
        validCount++;
      }
    }
  }

  if (validCount === 0 || min >= max) {
    min = 0;
    max = 1;
  }

  const mean = validCount > 0 ? sum / validCount : 0;
  let varianceSum = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const idx = y * width + x;
      const val = rasterData[idx];
      if (Number.isFinite(val)) {
        varianceSum += (val - mean) ** 2;
      }
    }
  }
  const stddev = validCount > 1 ? Math.sqrt(varianceSum / (validCount - 1)) : 1;

  // Calculate 1024-bin histogram vector over sampled points for percentile calculation
  const PERCENTILE_BINS = 1024;
  const percentileCounts = new Array(PERCENTILE_BINS).fill(0);
  const range = max - min;
  if (range > 0 && validCount > 0) {
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const idx = y * width + x;
        const val = rasterData[idx];
        if (Number.isFinite(val) && val >= min && val <= max) {
          const binIndex = Math.min(
            PERCENTILE_BINS - 1,
            Math.max(0, Math.floor(((val - min) / range) * PERCENTILE_BINS))
          );
          percentileCounts[binIndex]++;
        }
      }
    }
  }

  // Preserve ultra high resolution (up to 4096px)
  const maxDim = 4096;
  let previewWidth = width;
  let previewHeight = height;
  let scale = 1;

  if (width > maxDim || height > maxDim) {
    scale = Math.max(width / maxDim, height / maxDim);
    previewWidth = Math.round(width / scale);
    previewHeight = Math.round(height / scale);
  }

  const previewData = new Float32Array(previewWidth * previewHeight);
  for (let py = 0; py < previewHeight; py++) {
    for (let px = 0; px < previewWidth; px++) {
      const srcX = Math.min(width - 1, Math.floor(px * scale));
      const srcY = Math.min(height - 1, Math.floor(py * scale));
      previewData[py * previewWidth + px] = rasterData[srcY * width + srcX];
    }
  }

  return {
    width,
    height,
    bandCount: samplesPerPixel,
    activeBand: bandIndex,
    stats: {
      minimum: min,
      maximum: max,
      mean,
      stddev,
      validCount,
      noDataValue,
      percentileCounts,
    },
    geo: {
      crs,
      epsg,
      bbox,
      hasGeo,
    },
    previewWidth,
    previewHeight,
    previewData,
  };
}

type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;
