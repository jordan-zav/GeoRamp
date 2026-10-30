# GeoRamp 1.1.0 — feature completion and validation

Local experimental build, 28 October 2026. No publication is implied by this
report. QGIS 3.44.12 on Windows was exercised; other metadata-supported versions
have not been executed in this review.

## Requested behaviour and evidence

| Requirement | Implemented behaviour | Executed verification |
| --- | --- | --- |
| Stretch from a smaller extent | Whole raster, fixed main-canvas snapshot, current/following canvas, typed/drawn rectangle | Synthetic GUI and visible QGIS desktop with real elevations |
| Specify an area | Polygon layer, selected polygon features or a polygon drawn on the main map; holes excluded | Same-envelope triangle excludes a high inside the bounding rectangle but outside the polygon; hole and CRS tests |
| Updated-canvas stretch | Apply arms following on project-layer renderers; it continues after closing the dialog | Applied min/max change after panning with the dialog closed; stop leaves colours fixed |
| Show the distribution transfer | Green input-to-colour curve with its own percentage axis, separate from frequency | Built-in methods and custom transfer paths exercised; screenshot inspection |
| Edit min, max and intermediate points | Double-click, drag, numeric entry, arrow keys, deletion/reset; monotone ordering | Real Qt events, including a native numeric dialog, plus visible desktop mouse events |
| Preserve the workflow | Source/user NoData, saturated tails, continuous/discrete styles, QML and existing multi-layer settings | Transparency, independent followed palettes, QML colours and editable state, band/task tests |

## Validation layers

1. Twenty-one Python tests cover the numerical distribution/curve functions and
   metadata. Ruff checks the Python source and tests.
2. The distributable ZIP runs in an isolated QGIS application using native Qt
   widgets and task manager, offscreen, with a synthetic two-band raster.
3. The distributable ZIP is installed in a temporary QGIS desktop profile and
   loaded through the actual plugin manager in qgis-ltr-bin.exe, using the
   Windows platform rather than offscreen rendering. The real QGIS interface
   supplies the main canvas, layer tree and menus.
4. Captured desktop and curve images are inspected visually. Desktop interactions
   are automated and recorded as such; no human operator acceptance is claimed.

The desktop process exits through QGIS's normal exit action. Only the isolated
review instance/profile is affected. Existing QGIS sessions and user profiles are
preserved, and no private project inputs are used.

## Public elevation input

The desktop review uses Terrain Tiles tile S13W073, in Peru. It is downloaded
from the public elevation-tiles-prod S3 bucket and kept outside the repository.

- [Dataset registry](https://registry.opendata.aws/terrain-tiles/).
- [Source tile](https://s3.amazonaws.com/elevation-tiles-prod/skadi/S13/S13W073.hgt.gz).
- [Provider attribution and source licensing](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

The decompressed tile has 3601 by 3601 elevation cells. SHA-256:

    a635c7ab2f2f9682c4ee33ea53665d1589a3ed3325de2d2360f92e3448780962

The whole-tile 512 by 512 sample contained 262144 valid values, with sampled
limits 379–4898. The review checks smaller extents, automatic applied-layer
updates, polygon samples, curve edits and QML reload. The original tile's hash
is checked again afterwards and must be identical.

## Reproduction and artifacts

- Build the ZIP with scripts/package_plugin.py.
- Run tests/qgis_smoke.py through scripts/run_qgis_python.cmd for synthetic GUI
  checks. In the managed workspace, use DEVRESOURCES_RUN.cmd for development
  commands and the existing resource/lock conventions.
- Run scripts/qgis_desktop_review.py through QGIS Python for the normal desktop
  review. Supply the ZIP, local public DEM, a new output directory and QGIS binary.
- The scripts write machine-readable reports and process results in the review
  session. English captures are kept under assets/screenshots.
- The desktop report explicitly records the Qt platform, QGIS version, input
  hash, each check and whether the interactions are automated.

## Operational scope

Statistics are a bounded, deterministic 512 by 512 spatial sample, not a scan of
every native pixel. Polygon masks operate on sample centres and retain holes.
Rectangles in another CRS use transformed bounding envelopes. Manual limits
still override automatic/percentile limits until disabled.

Follow mode is armed by Apply and stays active while GeoRamp is loaded, even if
its window is closed. Each applied layer has independent style parameters. Stop
controls, external style changes, layer removal and plugin unload end following.
An empty/NoData-only extent reports failure while retaining the last valid style.
Stale tasks cannot overwrite a newer canvas request.

QML carries a native QGIS renderer plus curve/area metadata. Importing it restores
the saved area as a fixed snapshot, whereas a saved project can resume a follow
mode that was explicitly active. No exact equivalence to a proprietary product
is asserted; the evidence addresses the requested functions.
