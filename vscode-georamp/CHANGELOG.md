# Changelog

## 0.4.0 — 2026-09-19

- Bring QGIS histogram inspection to VS Code: cursor, median, tied approximate modes, mean markers and observed sigma coverage.
- Add alphabetical/hierarchical batch selection with groups, drag/Ctrl/Shift, per-raster calculations, progress, failure reporting and cancellation.
- Import/export single-band pseudocolor QML with exact stop preservation and saturated discrete extremes; add compact legends.
- Persist language, band, styles and imported palettes; restore per-raster/band settings.
- Restore fixed 512 × 512 statistical sampling independent of preview resolution; preserve NoData.
- Set RGB import interval count from palette rows and correct continuous break-table lower bounds.
- Add regression tests for QML, histogram coverage, selection, batch failures/cancellation and persistence.

## 0.3.0

- Add a project CRS with offline EPSG search and nonlinear on-the-fly raster reprojection.
- Preserve project CRS and view when selecting layers; allow source CRS overrides.
- Add nested layer groups, ordering, visibility, opacity and composite PNG export.
- Add source-pixel inspection, Float64 preservation and on-demand source detail.
- Document 2D datum/grid limitations and add projection, layer and UI regression tests.


## 0.2.1 - 2026-08-25

- Added the same deterministic 512 by 512 sampling grid used by the QGIS plugin.
- Matched statistics, percentile limits and equal-area histograms between both plugins.

## 0.2.0 - 2026-08-25

- Added bounded windowed decoding for large TIFF and BigTIFF files.
- Fixed NoData transport, reversed ramps, repeated band events, request races and PNG saving.
- Added cancellation, loading and error states, CSP protection and configurable preview size.

## 0.1.0 - 2026-08-25

- Initial GeoTIFF custom editor with live color ramps and statistical distributions.
