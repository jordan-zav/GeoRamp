# GeoRamp — GeoTIFF & Raster Viewer

**Visor rápido de rasters geoespaciales.**

Abre, superpone y explora tus rasters en VS Code.

Open, overlay and explore geospatial rasters in VS Code with scientific and geophysical color ramps.

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

## Progressive raster inspection

- The overview uses internal reduced images when available. Statistics and the
  histogram are estimates from that overview; they are not full-raster extrema.
- Zooming requests the visible source window after navigation settles. Each
  detail response is limited to 2048 pixels per dimension; two recent windows
  are cached. Superseded requests are cancelled and stale responses ignored.
- **1:1** maps one source pixel to one screen pixel. The zoom percentage refers
  to source resolution. At larger extents, detail can still be downsampled.
- Hover first displays a labelled preview sample, then queries the original
  pixel. Coordinates refer to that pixel, with PixelIsArea semantics respected.
  Float64 precision is retained and NoData remains transparent.
- PNG export saves the visible layer composition at viewport resolution.

Files without internal overviews may still require expensive initial decoding;
compressed strips can also make small source-window reads costly. This version
has not yet been benchmarked against large production rasters.

## Import manager

The left panel imports multiple local TIFF/GeoTIFF files, filters the list by
name or path, and selects the active raster. Duplicate URIs are ignored.
Removing a list entry never deletes the source file. The initial editor file
starts in the list; imports and per-band styles last for the open viewer session.

The right workspace contains the viewer and visualization controls. Controls
move below the viewer in narrower windows. Each raster/band retains its palette,
distribution and limits when switching. Pixel reads and PNG export target the
active raster. Clearing the list displays an import prompt.

## Layer tree and overlays

- Create nested groups, collapse them, and rename a focused group with F2.
- Drag a layer/group onto a group to nest it; drop onto a layer to place it
  above that layer. Drop on empty tree space to move to the root. Arrow buttons
  reorder siblings; the return arrow moves an entry out to the root.
- Checkboxes control layer and group visibility. Opacity multiplies down the
  group hierarchy. Topmost entries draw last, in front of lower entries.
- Selecting a raster edits its style while preserving the project CRS and view.
  Use Fit View to fit the selected layer; 1:1 uses its local projected pixel size.
- Overlays are reprojected into the project CRS. Missing source CRS can be
  assigned in the visualization panel without editing the original TIFF.
- Background layers use bounded 512-pixel previews; the selected layer retains
  on-demand source detail. NoData exposes the layers below. PNG export captures
  the current composite viewport, not a georeferenced raster or full-resolution export.
- The tree, groups and styles currently last for the open viewer session.

## Project CRS

The project CRS is initialized from the first supported georeferenced active
layer and remains independent of the selection. Search the local EPSG catalog
by code or name, then Apply. Changing project CRS transforms the current view
center and local scale. Invalid codes leave the previous project intact.

Each raster retains its source CRS. Assign Source CRS overrides its interpretation
for this viewer; Original removes the override. This does not rewrite coordinates,
metadata or source data. A missing affine georeference still requires georeferencing
outside this viewer. Project CRS and source overrides are stored in webview state.

Rendering uses an adaptive nonlinear mesh (target error 0.5 screen pixel, with
bounded subdivision); cursor probes use the inverse projection to query original
pixels. View extents sample the raster boundary, and detail windows sample the
inverse viewport. Only the selected layer receives high-resolution detail.

Projection definitions ship locally from epsg-index 2.0.0 and transformations use
Proj4js. This is a 2D visualization workflow: it does not implement QGIS/PROJ's
area-specific operation selection, downloadable datum grids, vertical datum or
epoch transformations. Definitions requiring missing grids are rejected; catalog
Helmert datum operations may be approximate and are labelled accordingly. Global
rasters crossing projection singularities or the antimeridian need further QA.

References: [Proj4js](https://proj4js.org/) and
[epsg-index](https://github.com/derhuerst/epsg-index).
