# GeoRamp VS Code Extension

Interactive GeoTIFF viewer for VS Code with scientific and geophysical color ramps.

## Features

- **GeoTIFF Custom Editor**: Opens .tif and .tiff files directly in VS Code.
- **27 Built-in Color Ramps**: Classic Geophysics, Viridis, Terrain, Turbo, Spectral, Seismic, etc.
- **RGB Table Import**: Loads CSV, TXT, TBL, ZON, CLR and LUT text palettes.
- **Statistical Distributions**: Linear, Normal (Sigma range), Equal Area (Histogram), Log-Linear.
- **Percentile Clipping**: Trim extreme outliers (e.g. 2%–98%).
- **Histogram & Breaks Table**: Visual breakdown of zones, value ranges, and colors.
- **Export PNG**: Save the rendered preview through the VS Code file picker.
- **Bilingual Interface**: Spanish / English support.

## Usage

1. Open any .tif or .tiff file in VS Code.
2. Right click the file in Explorer and select **GeoRamp: Open GeoTIFF Viewer**.

Large TIFF and BigTIFF files are decoded into a bounded preview instead of loading the full raster into memory. The preview limit is configurable with GeoRamp: Preview Max Dimension.
