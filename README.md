<div align="center">
  <img src="georamp/icon.svg" alt="GeoRamp" width="112">

# GeoRamp

**Visor rápido de rasters geoespaciales**

Abre, superpone y explora tus rasters en VS Code.

Scientific and geophysical raster colour ramps across QGIS and VS Code.

Inspect raster distributions, choose an explicit stretch and apply repeatable
continuous or classified colour tables without losing NoData semantics.

[![Status: internal testing](https://img.shields.io/badge/status-internal%20testing-f59e0b)](#project-status)
[![QGIS plugin 1.4.2](https://img.shields.io/badge/QGIS%20plugin-1.4.2-589632?logo=qgis&logoColor=white)](georamp/metadata.txt)
[![VS Code extension 0.3.0](https://img.shields.io/badge/VS%20Code-0.3.0-007acc?logo=visualstudiocode&logoColor=white)](vscode-georamp/package.json)
[![Tests](https://img.shields.io/github/actions/workflow/status/jordan-zav/GeoRamp/tests.yml?branch=main&label=tests)](https://github.com/jordan-zav/GeoRamp/actions/workflows/tests.yml)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-0f766e)](LICENSE)

</div>

> [!IMPORTANT]
> A colour ramp changes visualization, not raster values. Distribution choice,
> clipping and class limits can emphasize or suppress anomalies; preserve the
> original raster and record the style used for interpretation.

## Two interfaces, one visualization model

| Product | Purpose |
| --- | --- |
| QGIS plugin | Apply styles to loaded raster layers, inspect statistics and export QML |
| VS Code extension | Open GeoTIFF/BigTIFF previews with the same style concepts during development or data review |

The QGIS plugin is the primary GIS workflow. The VS Code extension is under
active internal development and does not replace CRS-aware analysis in QGIS.

## Workflow at a glance

```text
Raster layer / GeoTIFF
        │
        ▼
 Band + valid-data statistics + histogram
        │
        ▼
 Distribution + limits + intervals + colour ramp
        │
        ▼
 Live preview and class-break review
        │
        ├──► QGIS renderer / QML style
        └──► bounded VS Code raster preview
```

## Capabilities

| Area | Included support |
| --- | --- |
| Distributions | Linear, Normal, Equal Area/Histogram and Log-Linear |
| Ramps | 27 built-in geophysical, scientific, divergent, topographic and bathymetric ramps |
| Import | Text `CSV`, `TXT`, `TBL`, `ZON`, `CLR` and `LUT` colour tables |
| Classification | 2–255 intervals, continuous or discrete representation |
| Limits | Automatic/manual bounds, ramp inversion, sigma and percentile clipping |
| Inspection | Histogram, statistics, class table and live raster preview |
| Scale | One-layer or multi-layer application with cancelable processing |
| Persistence | Language, last configuration, imported table and QML style exchange |
| Localization | Spanish and English interface |

## Distribution models

| Distribution | Appropriate use |
| --- | --- |
| Linear | Uniform interpolation between selected minimum and maximum |
| Normal | Emphasize deviations around a mean using configurable sigma |
| Equal Area | Allocate similar valid-pixel counts to each interval |
| Log-Linear | Expand low positive values and compress a long positive tail |

NoData values are excluded from statistics and histograms. Logarithmic styling
requires a valid positive domain or an explicitly reviewed shift.

## Colour-table format

GeoRamp accepts `R,G,B` or `position,R,G,B` rows separated by commas,
semicolons or whitespace. Positions are sorted and normalized to 0–1; RGB values
must be between 0 and 255.

```text
position,R,G,B
0,0,0,255
25,0,255,255
50,0,255,0
75,255,255,0
100,255,0,0
```

Imported colour tables are user-supplied data. Built-in ramps are independent
visual approximations and are not proprietary commercial colour tables.

## Install the QGIS plugin

1. build or download the GeoRamp plugin ZIP;
2. open **Plugins → Manage and Install Plugins** in QGIS;
3. choose **Install from ZIP**; and
4. enable GeoRamp, then open **Raster → GeoRamp**.

The minimum supported version declared by the plugin is QGIS 3.34.

## QGIS usage

1. load one or more raster layers;
2. select the layer, band and distribution;
3. choose a ramp and continuous/discrete representation;
4. review histogram, clipping and proposed class limits;
5. preview before applying; and
6. save the style as QML when reproducibility matters.

See the [plugin-specific guide](georamp/README.md) for the complete interface
behavior and text-table examples.

## GeoRamp — GeoTIFF & Raster Viewer

From `vscode-georamp`:

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run package:vsix
```

The extension registers **GeoRamp: Open GeoTIFF Viewer** for `.tif` and `.tiff`
files. Large TIFF/BigTIFF files are decoded into a bounded preview controlled by
`georamp.previewMaxDimension`; this preview is not a full-resolution export.

## Development and verification

### QGIS/Python

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q
python scripts/package_plugin.py
```

### VS Code/TypeScript

```powershell
cd vscode-georamp
npm run typecheck
npm test
npm run check:webview
```

Software tests should be complemented with visual checks on constant, skewed,
signed and NoData-rich rasters.

## Repository map

| Path | Contents |
| --- | --- |
| `georamp` | QGIS plugin, metadata, ramps and localized interface |
| `vscode-georamp` | VS Code custom GeoTIFF editor |
| `tests` | Python distribution and metadata tests |
| `test-data` | Small raster/style fixtures |
| `scripts/package_plugin.py` | Reproducible QGIS ZIP builder |
| `.github/workflows/tests.yml` | Automated Python and extension quality gates |

## Project status

GeoRamp is in internal testing. The QGIS plugin reports version 1.4.2 and the VS
Code extension 0.3.0. The extension worktree currently contains active local
development, so packaging and cross-editor parity must be revalidated before a
public release.

## License and contact

GeoRamp is distributed under the [GNU General Public License v3.0](LICENSE).
Third-party runtime packages retain their own compatible licenses.

Jordan Zavaleta — GisGeo Dev<br>
[jordanzav@gisgeo.dev](mailto:jordanzav@gisgeo.dev) · [gisgeo.dev](https://gisgeo.dev)
