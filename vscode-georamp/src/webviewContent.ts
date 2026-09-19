import type * as vscode from 'vscode';
import { rasterPixelToModel, previewToReference } from './geo';
import { LayerTree } from './layerTree';
import { BUILTIN_PALETTES, normalizePaletteStops } from './palettes';

export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  fileName: string
): string {
  const nonce = getNonce();
  const projectionUri = webview.asWebviewUri
    ? webview.asWebviewUri(extensionUri.with({path:extensionUri.path + '/dist/projection.js'})).toString()
    : 'projection.js';
  const palettesJson = JSON.stringify(BUILTIN_PALETTES);
  const normalizePaletteStopsSource = normalizePaletteStops.toString();
  const rasterPixelToModelSource = rasterPixelToModel.toString();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>GeoRamp - ${escapeHtml(fileName)}</title>
  <style>
    :root {
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      --bg-color: var(--vscode-editor-background, #1e1e1e);
      --fg-color: var(--vscode-editor-foreground, #cccccc);
      --sidebar-bg: var(--vscode-sideBar-background, #252526);
      --card-bg: var(--vscode-input-background, #3c3c3c);
      --border-color: var(--vscode-widget-border, rgba(255, 255, 255, 0.12));
      --accent-color: var(--vscode-button-background, #0e639c);
      --accent-hover: var(--vscode-button-hoverBackground, #1177bb);
      --accent-fg: var(--vscode-button-foreground, #ffffff);
      --input-bg: var(--vscode-input-background, #3c3c3c);
      --input-fg: var(--vscode-input-foreground, #cccccc);
      --input-border: var(--vscode-input-border, #555555);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-family);
      background-color: var(--bg-color);
      color: var(--fg-color);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      font-size: 12px;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 14px;
      background-color: var(--sidebar-bg);
      border-bottom: 1px solid var(--border-color);
    }
    header h1 {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .main-container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .sidebar {
      width: 360px;
      background-color: var(--sidebar-bg);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 10px;
      gap: 10px;
    }

    .section-card {
      background-color: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 10px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      color: var(--fg-color);
      opacity: 0.9;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-bottom: 6px;
    }
    .form-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    label {
      font-size: 11px;
      opacity: 0.9;
    }

    select, input[type="text"], input[type="number"] {
      background-color: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 3px;
      padding: 3px 6px;
      font-family: inherit;
      font-size: 11px;
      width: 100%;
    }
    select:focus, input:focus {
      outline: 1px solid var(--accent-color);
    }

    .btn {
      background-color: var(--accent-color);
      color: var(--accent-fg);
      border: none;
      border-radius: 3px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    .btn:hover { background-color: var(--accent-hover); }
    .btn-secondary {
      background-color: transparent;
      border: 1px solid var(--input-border);
      color: var(--fg-color);
    }
    .btn-secondary:hover {
      background-color: rgba(255, 255, 255, 0.08);
    }

    /* Ramp Gallery Grid */
    .ramp-controls {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 6px;
    }
    .active-ramp-bar {
      height: 20px;
      border-radius: 3px;
      border: 1px solid var(--border-color);
      margin-bottom: 4px;
    }
    .active-ramp-name { font-weight: 600; margin-bottom: 4px; }
    .ramp-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5px;
      max-height: 160px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .ramp-item {
      border: 1px solid var(--border-color);
      border-radius: 3px;
      padding: 4px;
      cursor: pointer;
      background-color: rgba(0, 0, 0, 0.25);
      transition: border-color 0.15s;
    }
    .ramp-item:hover { border-color: var(--accent-color); }
    .ramp-item.selected {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 1px var(--accent-color);
    }
    .ramp-item-name {
      font-size: 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    .ramp-item-preview {
      height: 12px;
      border-radius: 2px;
    }

    /* Content Area */
    .content-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background-color: #1a1d23;
      position: relative;
    }

    .tabs {
      display: flex;
      background-color: var(--sidebar-bg);
      border-bottom: 1px solid var(--border-color);
    }
    .tab {
      padding: 6px 14px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      font-weight: 500;
      opacity: 0.7;
    }
    .tab.active {
      border-bottom-color: var(--accent-color);
      opacity: 1;
    }

    .tab-content {
      flex: 1;
      position: relative;
      display: none;
    }
    .tab-content.active { display: flex; flex-direction: column; }

    /* Canvas Viewport */
    .viewport {
      flex: 1;
      position: relative;
      overflow: hidden;
      background-color: var(--vscode-editor-background, #20242b);
      background-image: repeating-conic-gradient(#88888812 0% 25%, transparent 0% 50%);
      background-size: 20px 20px;
      user-select: none;
    }
    canvas#rasterCanvas {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      cursor: grab;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      transform-origin: 0 0;
      position: absolute;
      left: 0;
      top: 0;
    }
    canvas#rasterCanvas:active { cursor: grabbing; }

    .viewport-overlay {
      position: absolute;
      bottom: 10px;
      left: 10px;
      background-color: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(4px);
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 11px;
      color: #fff;
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      pointer-events: none;
      font-family: monospace;
      z-index: 10;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .stats-bar {
      font-size: 11px;
      line-height: 1.4;
      opacity: 0.9;
      margin-top: 2px;
      font-family: monospace;
      white-space: pre-line;
    }
    .status-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      background: rgba(26, 29, 35, 0.88);
      color: #fff;
      z-index: 20;
      font-size: 13px;
    }
    .status-overlay[hidden] { display: none; }

    /* Breaks Table */
    .breaks-container {
      flex: 1;
      overflow: auto;
      padding: 14px;
    }
    table.breaks-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      font-family: monospace;
    }
    table.breaks-table th, table.breaks-table td {
      border: 1px solid var(--border-color);
      padding: 5px 8px;
      text-align: left;
    }
    table.breaks-table th {
      background-color: var(--sidebar-bg);
      font-family: var(--font-family);
    }
    .color-swatch {
      width: 28px;
      height: 14px;
      border-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .histogram-card {
      height: 160px;
      margin-bottom: 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 8px;
      background-color: rgba(0, 0, 0, 0.3);
      position: relative;
    }
    canvas#histogramCanvas {
      width: 100%;
      height: 100%;
    }
    .import-manager { width: 235px; flex: 0 0 235px; padding: 14px 10px;
      display: flex; flex-direction: column; gap: 12px; overflow: hidden;
      background: var(--sidebar-bg); border-right: 1px solid var(--border-color); }
    .source-list { flex: 1; overflow-y: auto; min-height: 80px; }
    .source-row { display: flex; flex-wrap: wrap; margin-bottom: 6px; border: 1px solid var(--border-color); border-radius: 5px; }
    .source-row.active { border-color: var(--accent-color); background: var(--vscode-list-activeSelectionBackground, #173b53); }
    .source-open { flex: 1; min-width: 0; background: transparent; color: inherit; border: 0; text-align: left; padding: 10px 8px; cursor: pointer; }
    .source-open strong, .source-open small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .source-open small { opacity: .65; margin-top: 5px; }
    .source-remove { align-self: center; margin-right: 5px; padding: 5px 7px; }
    .manager-hint { font-size: 11px; opacity: .7; line-height: 1.5; }
    .visualization-workspace { display: flex; flex: 1; min-width: 0; overflow: hidden; }
    .content-area { min-width: 0; min-height: 0; }
    .visualization-controls { width: 290px; flex: 0 0 290px; border-right: 0; border-left: 1px solid var(--border-color); }
    .tab-content { min-height: 0; }
    .active-source-title { padding: 10px 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-bottom: 1px solid var(--border-color); }
    @media (max-width: 1050px) {
      .import-manager { width: 200px; flex-basis: 200px; }
      .visualization-workspace { flex-direction: column; }
      .visualization-controls { width: 100%; flex: 0 0 240px; border-left: 0; border-top: 1px solid var(--border-color); display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); }
    }
    @media (max-width: 600px) {
      .import-manager { width: 160px; flex-basis: 160px; }
      header { flex-wrap: wrap; gap: 6px; } .header-actions { flex-wrap: wrap; gap: 4px; }
      .visualization-controls { grid-template-columns: 1fr; flex-basis: 180px; }
    }
    .layer-options { display:flex; width:100%; align-items:center; gap:5px; padding:0 6px 6px; }
    .layer-options input[type=range] { width:65px; min-width:30px; flex:1; }
    .layer-status { width:100%; padding:0 8px 5px; font-size:10px; color:var(--vscode-descriptionForeground,#bbb); }
    .layer-visible { margin:8px 3px 8px 6px; }
    .group-row { background:var(--vscode-sideBarSectionHeader-background,#ffffff0a); }
    .import-manager { width:270px; flex-basis:270px; }
  </style>
</head>
<body>
  <header>
    <h1>
      <span id="titleText" data-i18n="title">GeoRamp — Visor rápido de rasters</span>
    </h1>
    <div class="header-actions">
      <select id="langSelect" style="width: 90px;">
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
      <button class="btn btn-secondary" id="btnExportPng"><span data-i18n="export_png">Exportar PNG</span></button>
      <button class="btn btn-secondary" id="btnNativeZoom" title="1 pixel = 1 screen pixel">1:1</button>
      <button class="btn btn-secondary" id="btnResetView"><span data-i18n="reset_zoom">Reset Zoom</span></button>
    </div>
  </header>

  <div class="main-container">
    <aside class="import-manager" aria-label="Importaciones">
      <div class="section-card">
        <label for="projectCrs">CRS del proyecto</label>
        <div class="form-row"><input id="projectCrs" type="text" list="crsChoices" placeholder="EPSG:32718" /><button id="applyProjectCrs" class="btn">Aplicar</button></div>
        <div id="projectCrsStatus" class="manager-hint" role="status">Automatico: primera capa con CRS</div>
        <datalist id="crsChoices"></datalist>
      </div>
      <div class="section-title" data-i18n="imports">Capas</div>
      <button class="btn" id="btnImportSources" data-i18n="add_rasters">+ Importar rasters</button>
      <div class="form-row"><input id="groupName" type="text" placeholder="Nombre del grupo" aria-label="Nombre del grupo" /><button class="btn btn-secondary" id="btnAddGroup">+ Grupo</button></div>
      <div class="manager-hint">Arrastra para agrupar y ordenar. Arriba = delante. Detalle en la capa seleccionada.</div>
      <input id="sourceSearch" type="text" aria-label="Buscar raster" placeholder="Buscar raster..." />
      <div id="sourceCount" class="manager-hint"></div>
      <div id="sourceList" class="source-list" aria-label="Rasters importados"></div>
      <p class="manager-hint" data-i18n="import_hint">Selecciona para editar. Marca para mostrar. Quitar no elimina el archivo.</p>
    </aside>
    <div class="visualization-workspace">
    <!-- MAIN VIEWER -->
    <div class="content-area">
      <div class="active-source-title" id="activeSourceTitle">${escapeHtml(fileName)}</div>
      <div class="tabs">
        <div class="tab active" data-tab="viewerTab" data-i18n="tab_viewer">Visor en tiempo real</div>
        <div class="tab" data-tab="breaksTab" data-i18n="tab_breaks">Histograma y Cortes</div>
      </div>

      <div class="tab-content active" id="viewerTab">
        <div class="viewport" id="viewport">
          <canvas id="compositionCanvas" style="position:absolute;left:0;top:0;pointer-events:none"></canvas><canvas id="rasterCanvas" style="visibility:hidden"></canvas><canvas id="detailCanvas" style="visibility:hidden;position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;image-rendering:pixelated;background-color:var(--vscode-editor-background,#20242b);background-image:repeating-conic-gradient(#88888812 0% 25%,transparent 0% 50%);background-size:20px 20px"></canvas>
          <div class="status-overlay" id="statusOverlay">Cargando GeoTIFF...</div>
          <div class="viewport-overlay" id="viewportOverlay">
            <span id="posOverlay">Píxel: X: - Y: -</span>
            <span id="geoOverlay">Coord: -</span>
            <span id="valOverlay">Valor: -</span>
            <span id="zoomOverlay">Zoom: 100%</span>
          </div>
        </div>
      </div>

      <div class="tab-content" id="breaksTab">
        <div class="breaks-container">
          <div class="histogram-card">
            <canvas id="histogramCanvas"></canvas>
          </div>
          <table class="breaks-table">
            <thead>
              <tr>
                <th data-i18n="tbl_zone">Zona</th>
                <th data-i18n="tbl_min">Mínimo</th>
                <th data-i18n="tbl_max">Máximo</th>
                <th data-i18n="tbl_color">Color</th>
              </tr>
            </thead>
            <tbody id="breaksTableBody"></tbody>
          </table>
        </div>
      </div>

    </div>
    <aside class="sidebar visualization-controls" aria-label="Visualizaci&#243;n">

      <!-- 1. DATOS -->
      <div class="section-card">
        <div class="section-title"><span data-i18n="sec_data">1. Datos</span></div>
        <div class="form-group">
          <label data-i18n="band">Banda:</label>
          <select id="bandSelect"></select>
        </div>
        <label for="sourceCrs">CRS de origen (esta capa)</label>
        <input id="sourceCrs" type="text" list="crsChoices" placeholder="EPSG:..." />
        <div class="form-row"><button id="assignSourceCrs" class="btn btn-secondary">Asignar CRS</button><button id="resetSourceCrs" class="btn btn-secondary">Original</button></div>
        <div class="stats-bar" id="statsBar">Cargando datos...</div>
      </div>

      <!-- 2. RAMPA DE COLOR -->
      <div class="section-card">
        <div class="section-title"><span data-i18n="sec_ramp">2. Rampa de color</span></div>
        <div class="ramp-controls">
          <div class="active-ramp-name" id="activeRampName"></div>
          <div class="active-ramp-bar" id="activeRampBar"></div>
          <div class="form-row">
            <input type="text" id="rampSearch" placeholder="Buscar rampa..." style="flex: 1;" />
            <label style="display: flex; align-items: center; gap: 4px; white-space: nowrap;">
              <input type="checkbox" id="chkReverse" />
              <span data-i18n="reverse">Invertir</span>
            </label>
          </div>
          <div class="form-row">
            <select id="rampCategorySelect">
              <option value="all" data-i18n="cat_all">Todas las categorías</option>
              <option value="geophysics" data-i18n="cat_geophysics">Geofísica</option>
              <option value="scientific" data-i18n="cat_scientific">Científica</option>
              <option value="diverging" data-i18n="cat_diverging">Divergente</option>
              <option value="topographic" data-i18n="cat_topographic">Topográfica</option>
              <option value="classic" data-i18n="cat_classic">Clásica</option>
              <option value="custom" data-i18n="cat_custom">Importada</option>
            </select>
          </div>
        </div>
        <div class="ramp-grid" id="rampGrid"></div>
        <div style="margin-top: 7px;">
          <button class="btn btn-secondary" id="btnImportRamp" style="width: 100%;" data-i18n="import_ramp">Importar tabla RGB...</button>
          <input type="file" id="rampFileInput" accept=".csv,.txt,.tbl,.zon,.clr,.lut" hidden />
        </div>
      </div>

      <!-- 3. DISTRIBUCIÓN -->
      <div class="section-card">
        <div class="section-title"><span data-i18n="sec_method">3. Distribución</span></div>
        <div class="form-group">
          <label data-i18n="distribution">Distribución:</label>
          <select id="distSelect">
            <option value="linear" data-i18n="dist_linear">Linear</option>
            <option value="normal" data-i18n="dist_normal">Normal</option>
            <option value="equal_area" data-i18n="dist_equal_area">Equal Area (Histograma)</option>
            <option value="log_linear" data-i18n="dist_log">Log-Linear</option>
          </select>
        </div>
        <div class="form-row">
          <label data-i18n="bins">Número de intervalos:</label>
          <input type="number" id="numBinsInput" min="2" max="255" value="39" style="width: 70px;" />
        </div>
        <div class="form-row" id="normalSigmaRow" style="display: none;">
          <label data-i18n="sigma">Rango sigma:</label>
          <input type="number" id="sigmaInput" step="0.1" value="2" min="0.5" max="6" style="width: 70px;" />
        </div>
        <div class="form-row" id="logShiftRow" style="display: none;">
          <label style="display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="chkShiftLog" />
            <span data-i18n="shift_log">Desplazar datos si ≤ 0</span>
          </label>
        </div>
        <div class="form-group">
          <label data-i18n="rendering">Representación:</label>
          <select id="renderModeSelect">
            <option value="continuous" data-i18n="render_continuous">Continuo (interpolado)</option>
            <option value="discrete" data-i18n="render_discrete">Zonas discretas</option>
          </select>
        </div>
      </div>

      <!-- 4. LÍMITES -->
      <div class="section-card">
        <div class="section-title"><span data-i18n="sec_limits">4. Límites</span></div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="chkManualLimits" />
            <span data-i18n="manual_limits">Usar límites manuales</span>
          </label>
        </div>
        <div class="form-row" id="manualLimitsGroup">
          <div style="flex: 1;">
            <label data-i18n="min">Mínimo:</label>
            <input type="number" id="manualMinInput" step="any" disabled />
          </div>
          <div style="flex: 1;">
            <label data-i18n="max">Máximo:</label>
            <input type="number" id="manualMaxInput" step="any" disabled />
          </div>
        </div>

        <div class="form-group" style="margin-top: 6px;">
          <label style="display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="chkPercentiles" />
            <span data-i18n="percentiles">Recortar por percentiles</span>
          </label>
        </div>
        <div class="form-row" id="percentilesGroup">
          <div style="flex: 1;">
            <label data-i18n="pct_low">Percentil Inf (%):</label>
            <input type="number" id="pctLowInput" value="2" min="0" max="99" disabled />
          </div>
          <div style="flex: 1;">
            <label data-i18n="pct_high">Percentil Sup (%):</label>
            <input type="number" id="pctHighInput" value="98" min="1" max="100" disabled />
          </div>
        </div>
      </div>

    </aside>
    </div>
  </div>

  <script nonce="${nonce}" src="${escapeHtml(projectionUri)}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const projection = GeoRampProjection;
    const BUILTIN_PALETTES = ${palettesJson};
    const normalizePaletteStops = ${normalizePaletteStopsSource};
    const rasterPixelToModel = ${rasterPixelToModelSource};
    const previewToReference = ${previewToReference.toString()};
    const LayerTree = ${LayerTree.toString()};

    // Dictionary
    const I18N = {
      es: {
        title: "GeoRamp — Visor rápido de rasters",
        export_png: "Exportar PNG",
        imports: "Capas", add_rasters: "+ Importar rasters",
        import_hint: "Selecciona para editar. Marca para mostrar. Quitar no elimina el archivo.",
        reset_zoom: "Ajustar vista",
        sec_data: "1. Datos",
        band: "Banda:",
        sec_ramp: "2. Rampa de color",
        reverse: "Invertir",
        cat_all: "Todas las categorías",
        cat_geophysics: "Geofísica",
        cat_scientific: "Científica",
        cat_diverging: "Divergente",
        cat_topographic: "Topográfica",
        cat_classic: "Clásica",
        cat_custom: "Importada",
        import_ramp: "Importar tabla RGB...",
        sec_method: "3. Distribución",
        distribution: "Distribución:",
        dist_linear: "Linear",
        dist_normal: "Normal",
        dist_equal_area: "Equal Area (Histograma)",
        dist_log: "Log-Linear",
        bins: "Número de intervalos:",
        sigma: "Rango sigma:",
        shift_log: "Desplazar datos si ≤ 0",
        rendering: "Representación:",
        render_continuous: "Continuo (interpolado)",
        render_discrete: "Zonas discretas",
        sec_limits: "4. Límites",
        manual_limits: "Usar límites manuales",
        min: "Mínimo:",
        max: "Máximo:",
        percentiles: "Recortar por percentiles",
        pct_low: "Percentil Inf (%):",
        pct_high: "Percentil Sup (%):",
        tab_viewer: "Visor en tiempo real",
        tab_breaks: "Histograma y Cortes",
        tbl_zone: "Zona",
        tbl_min: "Mínimo",
        tbl_max: "Máximo",
        tbl_color: "Color",
        loading: "Cargando GeoTIFF...",
        band_word: "Banda",
        stats_min: "Mín",
        stats_max: "Máx",
        stats_mean: "Media",
        stats_std: "Desv",
        none: "Ninguno",
        no_crs: "Sin CRS",
        pixel: "Píxel",
        value: "Valor",
        coord: "Coord",
        zoom: "Zoom",
        invalid_ramp: "La tabla RGB no es válida.",
        imported_ramp: "Rampa importada",
      },
      en: {
        title: "GeoRamp — GeoTIFF & Raster Viewer",
        export_png: "Export PNG",
        imports: "Layers", add_rasters: "+ Import rasters",
        import_hint: "Select a raster to view it. Removing an entry does not delete the file.",
        reset_zoom: "Fit view",
        sec_data: "1. Data",
        band: "Band:",
        sec_ramp: "2. Color Ramp",
        reverse: "Reverse",
        cat_all: "All categories",
        cat_geophysics: "Geophysics",
        cat_scientific: "Scientific",
        cat_diverging: "Diverging",
        cat_topographic: "Topographic",
        cat_classic: "Classic",
        cat_custom: "Imported",
        import_ramp: "Import RGB table...",
        sec_method: "3. Distribution",
        distribution: "Distribution:",
        dist_linear: "Linear",
        dist_normal: "Normal",
        dist_equal_area: "Equal Area (Histogram)",
        dist_log: "Log-Linear",
        bins: "Number of bins:",
        sigma: "Sigma range:",
        shift_log: "Shift data if ≤ 0",
        rendering: "Rendering:",
        render_continuous: "Continuous (interpolated)",
        render_discrete: "Discrete zones",
        sec_limits: "4. Limits",
        manual_limits: "Use manual limits",
        min: "Minimum:",
        max: "Maximum:",
        percentiles: "Clip outliers by percentile",
        pct_low: "Lower Percentile (%):",
        pct_high: "Upper Percentile (%):",
        tab_viewer: "Live Viewer",
        tab_breaks: "Histogram & Breaks",
        tbl_zone: "Zone",
        tbl_min: "Minimum",
        tbl_max: "Maximum",
        tbl_color: "Colour",
        loading: "Loading GeoTIFF...",
        band_word: "Band",
        stats_min: "Min",
        stats_max: "Max",
        stats_mean: "Mean",
        stats_std: "Std",
        none: "None",
        no_crs: "No CRS",
        pixel: "Pixel",
        value: "Value",
        coord: "Coord",
        zoom: "Zoom",
        invalid_ramp: "The RGB table is not valid.",
        imported_ramp: "Imported ramp",
      }
    };

    let currentLang = "es";
    let rasterInfo = null;
    let selectedPalette = BUILTIN_PALETTES[0];
    let isReversed = false;

    // Viewport Pan/Zoom state
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0, startY = 0;

    // UI elements
    const langSelect = document.getElementById("langSelect");
    const rampGrid = document.getElementById("rampGrid");
    const rampSearch = document.getElementById("rampSearch");
    const rampCategorySelect = document.getElementById("rampCategorySelect");
    const activeRampBar = document.getElementById("activeRampBar");
    const activeRampName = document.getElementById("activeRampName");
    const chkReverse = document.getElementById("chkReverse");
    const distSelect = document.getElementById("distSelect");
    const numBinsInput = document.getElementById("numBinsInput");
    const sigmaInput = document.getElementById("sigmaInput");
    const chkShiftLog = document.getElementById("chkShiftLog");
    const renderModeSelect = document.getElementById("renderModeSelect");
    const chkManualLimits = document.getElementById("chkManualLimits");
    const manualMinInput = document.getElementById("manualMinInput");
    const manualMaxInput = document.getElementById("manualMaxInput");
    const chkPercentiles = document.getElementById("chkPercentiles");
    const pctLowInput = document.getElementById("pctLowInput");
    const pctHighInput = document.getElementById("pctHighInput");
    const rasterCanvas = document.getElementById("rasterCanvas");
    const ctx = rasterCanvas.getContext("2d");
    const viewport = document.getElementById("viewport");
    const statusOverlay = document.getElementById("statusOverlay");
    const bandSelect = document.getElementById("bandSelect");

    // Acklam Probit Inverse Normal CDF (Matches NormalDist().inv_cdf in Python)
    function standardNormalInvCdf(p) {
      if (p <= 0) return -Infinity;
      if (p >= 1) return Infinity;
      const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
      const b = [-54.47609879859886, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
      const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
      const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
      const p_low = 0.02425;
      const p_high = 1 - p_low;
      let q, r;
      if (p < p_low) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
      } else if (p <= p_high) {
        q = p - 0.5; r = q * q;
        return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
      } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
      }
    }

    function errorFunction(x) {
      const sign = x < 0 ? -1 : 1; x = Math.abs(x);
      const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
      const t = 1.0 / (1.0 + p * x);
      const y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);
      return sign * y;
    }
    function standardNormalCdf(x) { return 0.5 * (1 + errorFunction(x / Math.SQRT2)); }

    const detailCanvas = document.getElementById("detailCanvas");
    let detail = null, shading = null, detailTimer, probeTimer;
    let detailId = 0, probeId = 0;
    const detailLabel = document.createElement("span");
    document.getElementById("zoomOverlay").parentElement.appendChild(detailLabel);
    function scheduleDetail() {
      clearTimeout(detailTimer); detailId++; detail = null; detailCanvas.hidden = true;
      if (!rasterInfo) return;
      detailLabel.textContent = currentLang === "es" ? "Vista general / estadisticas estimadas" : "Overview / estimated statistics";
      try{if (pixelScale()*zoom*rasterInfo.width/rasterInfo.previewWidth <= 1 || (rasterInfo.width===rasterInfo.previewWidth && rasterInfo.height===rasterInfo.previewHeight))return;}catch{return;}
      const id = detailId;
      detailTimer = setTimeout(() => {
        if(projectCrs){
          try{
            const rect=viewport.getBoundingClientRect(),window=projection.sourceWindow(rasterInfo,projectCrs,camera(),rect.width,rect.height);
            if(!window)return;
            detailLabel.textContent="Cargando detalle reproyectado...";
            const scale=pixelScale()*zoom;
            vscode.postMessage({type:"detail",id,sourceId:rasterInfo.sourceId,band:rasterInfo.activeBand,window,
              width:Math.min(2048,Math.ceil((window[2]-window[0])*scale)),height:Math.min(2048,Math.ceil((window[3]-window[1])*scale))});
          }catch{}
          return;
        }
        const sx = rasterInfo.width / rasterInfo.previewWidth, sy = rasterInfo.height / rasterInfo.previewHeight;
        const rect = viewport.getBoundingClientRect();
        const x0 = Math.max(0, Math.floor(-panX / zoom * sx)), y0 = Math.max(0, Math.floor(-panY / zoom * sy));
        const x1 = Math.min(rasterInfo.width, Math.ceil((rect.width-panX)/zoom*sx));
        const y1 = Math.min(rasterInfo.height, Math.ceil((rect.height-panY)/zoom*sy));
        if (x1 <= x0 || y1 <= y0) return;
        detailLabel.textContent = currentLang === "es" ? "Cargando detalle..." : "Loading detail...";
        vscode.postMessage({type:"detail", id, sourceId:rasterInfo.sourceId, band:rasterInfo.activeBand, window:[x0,y0,x1,y1],
          width:Math.ceil((x1-x0)/sx*zoom), height:Math.ceil((y1-y0)/sy*zoom)});
      }, 180);
    }
    function drawDetail() {
      if (!detail || !shading || !rasterInfo) return;
      const [x0,y0,x1,y1] = detail.window;
      const sx = rasterInfo.previewWidth/rasterInfo.width*zoom, sy = rasterInfo.previewHeight/rasterInfo.height*zoom;
      drawRasterCanvas(detail.width, detail.height, detail.data, shading.values, shading.colours, shading.mode, detailCanvas);
      detailCanvas.style.transform = "translate("+(panX+x0*sx)+"px,"+(panY+y0*sy)+"px) scale("+((x1-x0)*sx/detail.width)+","+((y1-y0)*sy/detail.height)+")";
      detailCanvas.hidden = false;
      renderComposition();
    }
    const styleInputs = ["distSelect","numBinsInput","sigmaInput","chkShiftLog","renderModeSelect",
      "chkManualLimits","manualMinInput","manualMaxInput","chkPercentiles","pctLowInput","pctHighInput","chkReverse"];
    function captureStyle() {
      return {palette:selectedPalette, reversed:isReversed, inputs:styleInputs.map(id => {
        const input = document.getElementById(id); return {id, value:input.value, checked:input.checked};
      })};
    }
    const defaultStyle = captureStyle(), sourceStyles = new Map();
    function restoreStyle(id, band) {
      const style = sourceStyles.get(id + ":" + band) || defaultStyle;
      selectedPalette = style.palette; isReversed = style.reversed;
      for (const saved of style.inputs) {
        const input = document.getElementById(saved.id); input.value = saved.value;
        if (saved.checked !== undefined) input.checked = saved.checked;
      }
      manualMinInput.disabled = manualMaxInput.disabled = !chkManualLimits.checked;
      pctLowInput.disabled = pctHighInput.disabled = !chkPercentiles.checked;
      document.getElementById("normalSigmaRow").style.display = distSelect.value === "normal" ? "flex" : "none";
      document.getElementById("logShiftRow").style.display = distSelect.value === "log_linear" ? "flex" : "none";
    }
    let sourceEntries = [], activeSourceId = "";
    const savedProject=vscode.getState?.() || {};
    let projectCrs=savedProject.projectCrs || null, viewInitialized=false;
    const sourceAssignments=new Map(Object.entries(savedProject.sourceAssignments || {}));
    function camera(){return {zoom,panX,panY};}
    function persistProject(){vscode.setState?.({...savedProject,projectCrs,sourceAssignments:Object.fromEntries(sourceAssignments)});}
    function prepareGeo(info){
      if(sourceAssignments.has(info.sourceId))info.geo={...info.geo,assignedCrs:sourceAssignments.get(info.sourceId)};
      return info;
    }
    function projectLabel(){
      document.getElementById("projectCrs").value=projectCrs || "";
      document.getElementById("projectCrsStatus").textContent=projectCrs ? projectCrs+" / "+projection.describe(projectCrs).name : "Sin CRS de proyecto";
    }
    function pixelScale(info=rasterInfo){
      if(!info)return 1;
      if(!projectCrs)return info.previewWidth/info.width;
      const map=projection.mapper(info,projectCrs),a=map.forward(info.width/2,info.height/2),b=map.forward(info.width/2+1,info.height/2);
      return Math.hypot(b[0]-a[0],b[1]-a[1]);
    }
    for(const id of ["projectCrs","sourceCrs"]){
      document.getElementById(id).addEventListener("input",event=>{
        const list=document.getElementById("crsChoices");list.replaceChildren();
        for(const crs of projection.search(event.target.value)){
          const option=document.createElement("option");option.value=crs.id;option.label=crs.name;list.appendChild(option);
        }
      });
    }
    document.getElementById("applyProjectCrs").addEventListener("click",()=>{
      try {
        const next=projection.describe(document.getElementById("projectCrs").value).id;
        const rect=viewport.getBoundingClientRect();
        let nextCamera=null;
        if(projectCrs && viewInitialized){
          const center=[(rect.width/2-panX)/zoom,-(rect.height/2-panY)/zoom];
          const mapped=projection.convert(projectCrs,next,center),adjacent=projection.convert(projectCrs,next,[center[0]+1/zoom,center[1]]);
          const scale=1/Math.hypot(mapped[0]-adjacent[0],mapped[1]-adjacent[1]);
          if(!Number.isFinite(scale) || scale<=0)throw new Error("Vista fuera del dominio del CRS");
          nextCamera={zoom:scale,panX:rect.width/2-mapped[0]*scale,panY:rect.height/2+mapped[1]*scale};
        }
        projectCrs=next;projectLabel();persistProject();
        if(nextCamera){({zoom,panX,panY}=nextCamera);updateTransform();}else resetTransform();
        renderSources();
      }catch(error){document.getElementById("projectCrsStatus").textContent=error.message;}
    });
    function assignSource(reset=false){
      if(!rasterInfo)return;
      try{
        if(reset){sourceAssignments.delete(rasterInfo.sourceId);delete rasterInfo.geo.assignedCrs;}
        else {const crs=projection.describe(document.getElementById("sourceCrs").value).id;
          sourceAssignments.set(rasterInfo.sourceId,crs);rasterInfo.geo.assignedCrs=crs;}
        const view=layerViews.get(rasterInfo.sourceId);if(view)view.info.geo={...rasterInfo.geo};
        if(!projectCrs){projectCrs=projection.describe(rasterInfo.geo.assignedCrs || rasterInfo.geo.epsg).id;viewInitialized=false;}
        persistProject();projectLabel();if(!viewInitialized)resetTransform();else updateTransform();renderSources();
      }catch(error){document.getElementById("projectCrsStatus").textContent=error.message;}
    }
    document.getElementById("assignSourceCrs").addEventListener("click",()=>assignSource());
    document.getElementById("resetSourceCrs").addEventListener("click",()=>assignSource(true));
    const tree = new LayerTree(), layerViews = new Map(), layerErrors = new Map();
    let pendingLayer = null, groupSequence = 0;
    const compositionCanvas = document.getElementById("compositionCanvas");
    function syncLayers() {
      const ids = new Set(sourceEntries.map(source => source.id));
      if (pendingLayer && !ids.has(pendingLayer)) pendingLayer=null;
      for (const node of [...tree.nodes]) if (node.kind === "layer" && !ids.has(node.id)) {
        tree.remove(node.id); layerViews.delete(node.id); layerErrors.delete(node.id);
      }
      for (const source of sourceEntries) tree.add(source.id,source.name);
      loadNextLayer();
    }
    function loadNextLayer() {
      if (pendingLayer) return;
      const next = tree.layers().find(layer => layer.visible && !layerViews.has(layer.id) && !layerErrors.has(layer.id));
      if (next) { pendingLayer = next.id; vscode.postMessage({type:"layerPreview",id:next.id}); }
    }
    function saveLayerView(info, canvas) {
      prepareGeo(info);
      const copy = document.createElement("canvas"); copy.dataset.sourceId=info.sourceId; copy.width=canvas.width; copy.height=canvas.height;
      copy.getContext("2d").drawImage(canvas,0,0);
      const {previewData,sampleData,previewDataBuffer,sampleDataBuffer,...metadata}=info;
      layerErrors.delete(info.sourceId);
      layerViews.set(info.sourceId,{info:metadata,canvas:copy});
    }
    function renderComposition() {
      const rect=viewport.getBoundingClientRect();
      compositionCanvas.width=Math.max(1,Math.round(rect.width)); compositionCanvas.height=Math.max(1,Math.round(rect.height));
      const context=compositionCanvas.getContext("2d"); context.imageSmoothingEnabled=false;
      if (!projectCrs && !rasterInfo) return;
      for (const layer of tree.layers().reverse()) {
        const view=layerViews.get(layer.id);
        if (!layer.visible || !view || layer.opacity <= 0) continue;
        try {
          const surface=document.createElement("canvas");surface.width=compositionCanvas.width;surface.height=compositionCanvas.height;surface.dataset.sourceId=layer.id;
          const target=surface.getContext("2d");target.imageSmoothingEnabled=false;
          if(projectCrs){
            projection.mapper(view.info,projectCrs);
            if(layer.id===rasterInfo?.sourceId && detail && shading){
              target.save();target.beginPath();target.rect(0,0,surface.width,surface.height);
              projection.traceWindow(target,rasterInfo,projectCrs,camera(),detail.window);target.clip("evenodd");
              projection.draw(target,view.canvas,view.info,projectCrs,camera());target.restore();
              projection.draw(target,detailCanvas,rasterInfo,projectCrs,camera(),detail.window);
            } else projection.draw(target,view.canvas,view.info,projectCrs,camera());
          }else if(layer.id===rasterInfo?.sourceId){target.translate(panX,panY);target.scale(zoom,zoom);target.drawImage(view.canvas,0,0);}
          else continue;
          context.globalAlpha=layer.opacity;context.drawImage(surface,0,0);
        }catch { /* The layer row explains unsupported or missing source CRS. */ }
      }
    }
    function crsStatus(info){
      if(!projectCrs)return info.geo?.crs || "Sin CRS";
      try{projection.mapper(info,projectCrs);const source=projection.describe(info.geo.assignedCrs || info.geo.epsg);
        return source.id+(source.id!==projectCrs ? " > "+projectCrs : "")+(info.geo.assignedCrs ? " (asignado)" : "")+(source.id!==projectCrs && (source.accuracy>0 || projection.describe(projectCrs).accuracy>0) ? " / datum aprox." : "");
      }catch(error){return error.message;}
    }

    function renderSources() {
      const list = document.getElementById("sourceList"); list.replaceChildren();
      const query = document.getElementById("sourceSearch").value.toLowerCase();
      document.getElementById("sourceCount").textContent = sourceEntries.length + (currentLang === "es" ? " capas / arriba = delante" : " layers / top = front");
      const draw = (parent,depth) => {
        for (const node of tree.nodes.filter(node => node.parent === parent)) {
          const source=sourceEntries.find(source=>source.id===node.id);
          if (query && node.kind === "layer" && !(node.name+source?.path).toLowerCase().includes(query)) continue;
          const row=document.createElement("div"); row.className="source-row"+(node.id===activeSourceId ? " active" : "")+(node.kind==="group" ? " group-row" : "");
          row.style.marginLeft=depth*12+"px"; row.draggable=true; row.dataset.id=node.id;
          row.addEventListener("dragstart",event=>event.dataTransfer.setData("text/plain",node.id));
          row.addEventListener("dragover",event=>event.preventDefault());
          row.addEventListener("drop",event=>{event.preventDefault();event.stopPropagation();
            tree.move(event.dataTransfer.getData("text/plain"),node.kind==="group" ? node.id : node.parent,node.kind==="group" ? undefined : node.id);
            renderSources();renderComposition();});
          const visible=document.createElement("input");visible.type="checkbox";visible.className="layer-visible";visible.checked=node.visible;
          visible.setAttribute("aria-label",(currentLang==="es" ? "Mostrar " : "Show ")+node.name);
          visible.addEventListener("change",()=>{node.visible=visible.checked;loadNextLayer();renderComposition();});
          const open=document.createElement("button");open.className="source-open";open.title=source?.path || node.name;
          const name=document.createElement("strong");name.textContent=(node.kind==="group" ? (node.expanded ? "\u25be " : "\u25b8 ") : "")+node.name;open.appendChild(name);
          open.setAttribute("aria-pressed",String(node.id===activeSourceId));
          if (node.kind === "group") {
            open.title = "F2 para renombrar";
            const rename = () => {
              const input=document.createElement("input");input.type="text";input.value=node.name;
              input.setAttribute("aria-label","Nombre del grupo");name.replaceWith(input);
              input.addEventListener("click",event=>event.stopPropagation());
              let done=false;
              const commit=()=>{if(done)return;done=true;node.name=input.value.trim() || node.name;renderSources();};
              input.addEventListener("blur",commit);
              input.addEventListener("keydown",event=>{if(event.key==="Enter")commit();if(event.key==="Escape"){done=true;renderSources();}});
              input.focus();input.select();
            };

            open.addEventListener("keydown",event=>{if(event.key==="F2"){event.preventDefault();rename();}});
          }
          open.addEventListener("click",()=>{if(node.kind==="group"){node.expanded=!node.expanded;renderSources();}
            else vscode.postMessage({type:"selectSource",id:node.id});});
          const remove=document.createElement("button");remove.className="btn btn-secondary source-remove";remove.textContent="\u00d7";
          remove.title="Quitar "+node.name;remove.setAttribute("aria-label",remove.title);
          remove.addEventListener("click",()=>{if(node.kind==="group"){tree.remove(node.id);renderSources();renderComposition();}
            else vscode.postMessage({type:"removeSource",id:node.id});});
          row.append(visible,open,remove);
          const options=document.createElement("div");options.className="layer-options";
          const opacity=document.createElement("input");opacity.type="range";opacity.min="0";opacity.max="100";opacity.value=String(node.opacity*100);opacity.setAttribute("aria-label","Opacidad "+node.name);
          const value=document.createElement("span");value.textContent=opacity.value+"%";
          opacity.addEventListener("input",()=>{node.opacity=Number(opacity.value)/100;value.textContent=opacity.value+"%";renderComposition();});
          options.append(opacity,value);
          for(const direction of [-1,1]) {
            const button=document.createElement("button");button.className="btn btn-secondary";button.textContent=direction<0 ? "\u2191" : "\u2193";
            button.title=direction<0 ? "Subir" : "Bajar";
            button.addEventListener("click",()=>{const siblings=tree.nodes.filter(n=>n.parent===node.parent),index=siblings.indexOf(node),target=index+direction;
              if(target<0 || target>=siblings.length)return;
              tree.move(node.id,node.parent,direction<0 ? siblings[target].id : siblings[target+1]?.id);renderSources();renderComposition();});options.appendChild(button);
          }
          if(node.parent){const ungroup=document.createElement("button");ungroup.className="btn btn-secondary";ungroup.textContent="\u21b0";ungroup.title="Sacar del grupo";
            ungroup.addEventListener("click",()=>{tree.move(node.id,null);renderSources();renderComposition();});options.appendChild(ungroup);}
          row.appendChild(options);
          if(node.kind==="layer") {
            const view=layerViews.get(node.id),status=document.createElement("div");status.className="layer-status";
            status.textContent=layerErrors.get(node.id) || (!view ? "Cargando vista..." : crsStatus(view.info));
            row.appendChild(status);
          }
          list.appendChild(row);
          if(node.kind==="group" && (node.expanded || query))draw(node.id,depth+1);
        }
      };draw(null,0);
    }
    document.getElementById("btnAddGroup").addEventListener("click",()=>{
      const input=document.getElementById("groupName");tree.add("group:"+(++groupSequence),input.value.trim() || "Grupo "+groupSequence,"group");input.value="";renderSources();
    });
    document.getElementById("sourceList").addEventListener("dragover",event=>event.preventDefault());
    document.getElementById("sourceList").addEventListener("drop",event=>{event.preventDefault();tree.move(event.dataTransfer.getData("text/plain"),null);renderSources();renderComposition();});
    document.getElementById("btnImportSources").addEventListener("click", () => vscode.postMessage({type:"importSources"}));
    document.getElementById("sourceSearch").addEventListener("input", renderSources);
    function clearRaster() {
      if (rasterInfo) sourceStyles.set(rasterInfo.sourceId + ":" + rasterInfo.activeBand, captureStyle());
      clearTimeout(detailTimer); clearTimeout(probeTimer); detailId++; probeId++;
      detail = null; rasterInfo = null; detailCanvas.hidden = true;
      ctx.clearRect(0,0,rasterCanvas.width,rasterCanvas.height);
      bandSelect.replaceChildren(); bandSelect.disabled = true;
      document.getElementById("statsBar").textContent = "";
      document.getElementById("breaksTableBody").replaceChildren();
      const hist = document.getElementById("histogramCanvas"); hist.getContext("2d").clearRect(0,0,hist.width,hist.height);
      for (const id of ["posOverlay","geoOverlay","valOverlay","zoomOverlay"]) document.getElementById(id).textContent = "-";
      detailLabel.textContent = "";
      renderComposition();
    }
    // Init messaging
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "sources") {
        sourceEntries = message.sources; activeSourceId = message.activeId; syncLayers(); renderSources(); renderComposition();
      } else if (message.type === "layerPreview") {
        if (pendingLayer === message.id) pendingLayer=null;
        if (tree.nodes.some(node=>node.id===message.id) && !layerViews.has(message.id) && message.id !== rasterInfo?.sourceId) {
          const info=message.data,data=new Float64Array(info.previewDataBuffer),canvas=document.createElement("canvas");
          const values=Array.from({length:39},(_,index)=>info.stats.minimum+(info.stats.maximum-info.stats.minimum)*index/38);
          const colours=Array.from({length:39},(_,index)=>interpolateColorHex(BUILTIN_PALETTES[0].stops,index/38));
          drawRasterCanvas(info.previewWidth,info.previewHeight,data,values,colours,"continuous",canvas);
          saveLayerView(info,canvas);
        }
        loadNextLayer();renderSources();renderComposition();
      } else if (message.type === "layerError") {
        if(pendingLayer===message.id)pendingLayer=null;
        layerErrors.set(message.id,message.message);loadNextLayer();renderSources();
      } else if (message.type === "empty") {
        clearRaster(); statusOverlay.hidden = false;
        statusOverlay.textContent = currentLang === "es" ? "Importa un raster para comenzar" : "Import a raster to start";
        document.getElementById("activeSourceTitle").textContent = "GeoRamp";
      } else if (message.type === "detail" && message.id === detailId && rasterInfo && message.band === rasterInfo.activeBand) {
        detail = {...message, data:new Float64Array(message.buffer)}; drawDetail();
        const native = detail.width === detail.window[2]-detail.window[0] && detail.height === detail.window[3]-detail.window[1];
        detailLabel.textContent = native ? (currentLang === "es" ? "Resolucion original / estadisticas estimadas" : "Native resolution / estimated statistics") : (currentLang === "es" ? "Detalle / estadisticas estimadas" : "Detail / estimated statistics");
      } else if (message.type === "probe" && message.id === probeId && rasterInfo && message.band === rasterInfo.activeBand) {
        const value = new Float64Array(message.buffer)[0];
        document.getElementById("valOverlay").textContent = (currentLang === "es" ? "Valor original: " : "Source value: ")+(Number.isFinite(value) ? String(value) : "NoData");
      } else if (message.type === "detailError") {
        if (message.kind === "detail" && message.id === detailId) detailLabel.textContent = message.message;
        if (message.kind === "probe" && message.id === probeId) document.getElementById("valOverlay").textContent = message.message;
      } else if (message.type === "init") {
        rasterInfo = prepareGeo(message.data);
        if(!projectCrs && (rasterInfo.geo?.assignedCrs || rasterInfo.geo?.epsg)){
          try{projectCrs=projection.describe(rasterInfo.geo.assignedCrs || rasterInfo.geo.epsg).id;viewInitialized=false;persistProject();}catch{}
        }
        try{projectLabel();}catch{projectCrs=null;}
        document.getElementById("sourceCrs").value=rasterInfo.geo.assignedCrs || (rasterInfo.geo.epsg ? "EPSG:"+rasterInfo.geo.epsg : "");
        restoreStyle(rasterInfo.sourceId, rasterInfo.activeBand);
        document.getElementById("activeSourceTitle").textContent = rasterInfo.fileName;
        document.title = "GeoRamp - " + rasterInfo.fileName;
        rasterInfo.previewData = new Float64Array(message.data.previewDataBuffer);
        rasterInfo.sampleData = new Float64Array(message.data.sampleDataBuffer);
        bandSelect.disabled = false;
        statusOverlay.hidden = true;
        initBandSelect();
        updateStatsUI();
        renderRampGrid();
        updateActiveRampBar();
        updateAndRender();
        if(!viewInitialized)resetTransform();else updateTransform();
      } else if (message.type === "loading") {
        clearRaster();
        document.getElementById("activeSourceTitle").textContent = sourceEntries.find(source => source.id === message.sourceId)?.name || "GeoRamp";
        bandSelect.disabled = true;
        statusOverlay.textContent = I18N[currentLang].loading;
        statusOverlay.hidden = false;
      } else if (message.type === "error") {
        bandSelect.disabled = false;
        statusOverlay.textContent = message.message || "GeoTIFF error";
        statusOverlay.hidden = false;
      }
    });

    langSelect.addEventListener("change", (e) => {
      currentLang = e.target.value;
      renderSources();
      document.getElementById("sourceSearch").placeholder = currentLang === "es" ? "Buscar raster..." : "Search rasters...";
      updateLanguage();
    });

    function updateLanguage() {
      const dict = I18N[currentLang];
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) el.textContent = dict[key];
      });
      rampSearch.placeholder = currentLang === "en" ? "Search ramp..." : "Buscar rampa...";
      renderRampGrid();
      updateActiveRampBar();
      if (rasterInfo) {
        initBandSelect();
        updateStatsUI();
      }
    }

    function initBandSelect() {
      bandSelect.innerHTML = "";
      for (let i = 0; i < rasterInfo.bandCount; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = \`\${I18N[currentLang].band_word} \${i + 1}\`;
        if (i === rasterInfo.activeBand) opt.selected = true;
        bandSelect.appendChild(opt);
      }
    }
    bandSelect.addEventListener("change", (e) => {
      vscode.postMessage({ type: "changeBand", sourceId:rasterInfo?.sourceId, band: parseInt(e.target.value) });
    });

    function updateStatsUI() {
      const s = rasterInfo.stats;
      const geo = rasterInfo.geo;
      const dict = I18N[currentLang];
      let geoText = "";
      if (geo && geo.hasGeo && geo.bbox) {
        const [minX, minY, maxX, maxY] = geo.bbox;
        geoText = \`\nCRS: \${geo.crs}\nBBOX: E[\${minX.toFixed(2)}, \${maxX.toFixed(2)}] N[\${minY.toFixed(2)}, \${maxY.toFixed(2)}]\`;
      } else {
        geoText = \`\nCRS: \${geo ? geo.crs : dict.no_crs}\`;
      }

      document.getElementById("statsBar").textContent =
        \`\${dict.stats_min}: \${s.minimum.toPrecision(6)} | \${dict.stats_max}: \${s.maximum.toPrecision(6)}\n\` +
        \`\${dict.stats_mean}: \${s.mean.toPrecision(6)} | \${dict.stats_std}: \${s.stddev.toPrecision(6)}\n\` +
        \`NoData: \${s.noDataValue !== null ? s.noDataValue : dict.none}\` + geoText;

      if (!chkManualLimits.checked) {
        manualMinInput.value = s.minimum.toFixed(4);
        manualMaxInput.value = s.maximum.toFixed(4);
      }
    }

    // Ramp Gallery
    function renderRampGrid() {
      const search = rampSearch.value.toLowerCase();
      const cat = rampCategorySelect.value;
      rampGrid.innerHTML = "";

      BUILTIN_PALETTES.forEach((p) => {
        const name = currentLang === "en" ? p.nameEn : p.nameEs;
        if (cat !== "all" && p.category !== cat) return;
        if (search && !name.toLowerCase().includes(search) && !p.id.includes(search)) return;

        const item = document.createElement("div");
        item.className = "ramp-item" + (p.id === selectedPalette.id ? " selected" : "");
        item.onclick = () => {
          selectedPalette = p;
          renderRampGrid();
          updateActiveRampBar();
          updateAndRender();
        };

        const nameEl = document.createElement("div");
        nameEl.className = "ramp-item-name";
        nameEl.textContent = name;

        const prevEl = document.createElement("div");
        prevEl.className = "ramp-item-preview";
        prevEl.style.background = makeGradientCss(p.stops, isReversed);

        item.appendChild(nameEl);
        item.appendChild(prevEl);
        rampGrid.appendChild(item);
      });
    }

    function updateActiveRampBar() {
      activeRampBar.style.background = makeGradientCss(selectedPalette.stops, isReversed);
      activeRampName.textContent = currentLang === "en" ? selectedPalette.nameEn : selectedPalette.nameEs;
    }

    function getActiveStops() {
      return normalizePaletteStops(selectedPalette.stops, isReversed);
    }

    function makeGradientCss(stops, reversed) {
      const activeStops = normalizePaletteStops(stops, reversed);
      const str = activeStops.map((s) => {
        const pos = s.position * 100;
        return \`\${s.color} \${pos.toFixed(1)}%\`;
      }).join(", ");
      return \`linear-gradient(to right, \${str})\`;
    }

    rampSearch.addEventListener("input", renderRampGrid);
    rampCategorySelect.addEventListener("change", renderRampGrid);
    chkReverse.addEventListener("change", (e) => {
      isReversed = e.target.checked;
      updateActiveRampBar();
      renderRampGrid();
      updateAndRender();
    });

    const rampFileInput = document.getElementById("rampFileInput");
    document.getElementById("btnImportRamp").addEventListener("click", () => rampFileInput.click());
    rampFileInput.addEventListener("change", async () => {
      const file = rampFileInput.files && rampFileInput.files[0];
      if (!file) return;
      try {
        const palette = parseRgbTable(await file.text(), file.name);
        const previous = BUILTIN_PALETTES.findIndex((item) => item.category === "custom");
        if (previous >= 0) BUILTIN_PALETTES.splice(previous, 1);
        BUILTIN_PALETTES.push(palette);
        selectedPalette = palette;
        rampCategorySelect.value = "custom";
        rampSearch.value = "";
        renderRampGrid();
        updateActiveRampBar();
        updateAndRender();
      } catch {
        statusOverlay.textContent = I18N[currentLang].invalid_ramp;
        statusOverlay.hidden = false;
        setTimeout(() => { if (rasterInfo) statusOverlay.hidden = true; }, 2500);
      } finally {
        rampFileInput.value = "";
      }
    });

    function parseRgbTable(text, name) {
      const rows = [];
      for (const sourceLine of text.split(/\\r?\\n/)) {
        const line = sourceLine.trim();
        if (!line || line.startsWith("#") || line.startsWith("//") || line.startsWith("!")) continue;
        const values = (line.match(/[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?/g) || []).map(Number);
        if (values.length >= 3) {
          rows.push({ position: values.length === 3 ? null : values[0], rgb: values.slice(-3) });
        }
      }
      if (rows.length < 2 || rows.some((row) => row.rgb.some((value) => !Number.isFinite(value) || value < 0 || value > 255))) {
        throw new Error("invalid RGB");
      }
      const positioned = rows.every((row) => row.position !== null);
      if (!positioned && !rows.every((row) => row.position === null)) throw new Error("mixed positions");
      if (positioned) rows.sort((left, right) => left.position - right.position);
      const low = positioned ? rows[0].position : 0;
      const high = positioned ? rows[rows.length - 1].position : rows.length - 1;
      if (!(high > low) || (positioned && rows.some((row, index) => index > 0 && row.position === rows[index - 1].position))) {
        throw new Error("invalid positions");
      }
      const stops = rows.map((row, index) => ({
        position: positioned ? (row.position - low) / (high - low) : index / (rows.length - 1),
        color: "#" + row.rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")
      }));
      return {
        id: "custom",
        nameEs: \`\${I18N.es.imported_ramp}: \${name}\`,
        nameEn: \`\${I18N.en.imported_ramp}: \${name}\`,
        category: "custom",
        stops
      };
    }

    // Controls
    distSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      document.getElementById("normalSigmaRow").style.display = val === "normal" ? "flex" : "none";
      document.getElementById("logShiftRow").style.display = val === "log_linear" ? "flex" : "none";
      updateAndRender();
    });
    numBinsInput.addEventListener("input", updateAndRender);
    sigmaInput.addEventListener("input", updateAndRender);
    chkShiftLog.addEventListener("change", updateAndRender);
    renderModeSelect.addEventListener("change", updateAndRender);

    chkManualLimits.addEventListener("change", (e) => {
      if (e.target.checked) {
        chkPercentiles.checked = false;
        pctLowInput.disabled = true;
        pctHighInput.disabled = true;
      }
      manualMinInput.disabled = !e.target.checked;
      manualMaxInput.disabled = !e.target.checked;
      updateAndRender();
    });
    manualMinInput.addEventListener("input", updateAndRender);
    manualMaxInput.addEventListener("input", updateAndRender);

    chkPercentiles.addEventListener("change", (e) => {
      if (e.target.checked) {
        chkManualLimits.checked = false;
        manualMinInput.disabled = true;
        manualMaxInput.disabled = true;
      }
      pctLowInput.disabled = !e.target.checked;
      pctHighInput.disabled = !e.target.checked;
      updateAndRender();
    });
    pctLowInput.addEventListener("input", updateAndRender);
    pctHighInput.addEventListener("input", updateAndRender);

    // QGIS distributions.py histogram_quantiles
    function histogramQuantiles(positions, minimum, maximum, counts) {
      const total = counts.reduce((sum, c) => sum + c, 0);
      if (!counts.length || total <= 0) {
        throw new Error("No se pudo calcular el histograma.");
      }
      return positions.map((p) => {
        if (p <= 0) return minimum;
        if (p >= 1) return maximum;
        const target = p * total;
        let cumulative = 0;
        let index = 0;
        while (index < counts.length - 1 && cumulative + counts[index] < target) {
          cumulative += counts[index];
          index++;
        }
        const within = counts[index] ? (target - cumulative) / counts[index] : 0.5;
        const fraction = (index + Math.min(1, Math.max(0, within))) / counts.length;
        return minimum + fraction * (maximum - minimum);
      });
    }

    // QGIS distributions.py calculate_values
    function calculateValues(positions, method, minimum, maximum, mean, stddev, counts, sigma, shiftLog) {
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum) {
        throw new Error("El rango de datos no es válido.");
      }

      if (method === "linear") {
        return positions.map((p) => minimum + p * (maximum - minimum));
      }

      if (method === "normal") {
        if (!Number.isFinite(mean) || !Number.isFinite(stddev) || stddev <= 0) {
          throw new Error("La desviación estándar no es válida.");
        }
        const low = standardNormalCdf(-sigma);
        const high = standardNormalCdf(sigma);
        return positions.map((p) => {
          const val = mean + stddev * standardNormalInvCdf(low + p * (high - low));
          return Math.min(maximum, Math.max(minimum, val));
        });
      }

      if (method === "log_linear") {
        let offset = 0;
        if (minimum <= 0) {
          if (!shiftLog) {
            throw new Error("Log-Linear requiere datos positivos. Activa el desplazamiento para ceros/negativos.");
          }
          offset = 1 - minimum;
        }
        const low = Math.log(minimum + offset);
        const high = Math.log(maximum + offset);
        return positions.map((p) => Math.exp(low + p * (high - low)) - offset);
      }

      if (method === "equal_area") {
        return histogramQuantiles(positions, minimum, maximum, counts);
      }

      throw new Error("Distribución desconocida.");
    }

    // QGIS distributions.py percentile_range (uses 1024-bin percentileCounts over data_minimum..data_maximum)
    function computePercentileRangeQgis(percentileCounts, dataMin, dataMax, lowP, highP) {
      const [low, high] = histogramQuantiles(
        [lowP / 100, highP / 100],
        dataMin,
        dataMax,
        percentileCounts
      );
      return { low, high };
    }

    // Compute 256-bin histogram over target range [minimum, maximum] matching QGIS analyse_raster_task
    function computeHistogramCountsInRange(data, minimum, maximum) {
      const HISTOGRAM_BINS = 256;
      const counts = new Array(HISTOGRAM_BINS).fill(0);
      const range = maximum - minimum;
      if (range <= 0) return counts;

      for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (Number.isFinite(val) && val >= minimum && val <= maximum) {
          const binIdx = Math.min(
            HISTOGRAM_BINS - 1,
            Math.max(0, Math.floor(((val - minimum) / range) * HISTOGRAM_BINS))
          );
          counts[binIdx]++;
        }
      }
      return counts;
    }

    // Matches plugin.py calculate_breaks
    function calculateBreaksQgis(rasterData, stats, min, max) {
      const bins = Math.min(255, Math.max(2, parseInt(numBinsInput.value) || 39));
      const method = distSelect.value;
      const requestedSigma = Number(sigmaInput.value);
      const sigma = Number.isFinite(requestedSigma)
        ? Math.min(6, Math.max(0.5, requestedSigma))
        : 2;
      const shiftLog = chkShiftLog.checked;
      const renderMode = renderModeSelect.value;

      // Compute 256-bin histogram over the target [min, max] range
      const counts = computeHistogramCountsInRange(rasterData, min, max);

      let values, edges;
      if (method === "equal_area") {
        const pos = Array.from({ length: bins + 1 }, (_, i) => i / bins);
        edges = calculateValues(pos, method, min, max, stats.mean, stats.stddev, counts, sigma, shiftLog);
        values = edges.slice(1);
      } else {
        const pos = renderMode === "discrete"
          ? Array.from({ length: bins }, (_, i) => (i + 1) / bins)
          : Array.from({ length: bins }, (_, i) => i / Math.max(1, bins - 1));
        values = calculateValues(pos, method, min, max, stats.mean, stats.stddev, counts, sigma, shiftLog);
        edges = renderMode === "discrete" ? [min, ...values] : values;
      }

      return { values, edges, bins, renderMode, counts };
    }

    function interpolateColorHex(stops, t) {
      const clampedT = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
      const len = stops.length;
      if (clampedT <= 0) return parseHex(stops[0].color);
      if (clampedT >= 1) return parseHex(stops[len - 1].color);
      for (let i = 0; i < len - 1; i++) {
        if (clampedT >= stops[i].position && clampedT <= stops[i + 1].position) {
          const range = stops[i + 1].position - stops[i].position || 1;
          const factor = (clampedT - stops[i].position) / range;
          const c1 = parseHex(stops[i].color);
          const c2 = parseHex(stops[i + 1].color);
          return [
            Math.round(c1[0] + factor * (c2[0] - c1[0])),
            Math.round(c1[1] + factor * (c2[1] - c1[1])),
            Math.round(c1[2] + factor * (c2[2] - c1[2]))
          ];
        }
      }
      return parseHex(stops[len - 1].color);
    }

    function parseHex(hex) {
      let h = hex.replace("#", "");
      if (h.length === 3) h = h.split("").map(c => c + c).join("");
      const num = parseInt(h, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }

    // Matches QgsColorRampShader Discrete & Interpolated logic in QGIS plugin create_renderer
    function evaluateQgisShader(val, values, colours, renderMode) {
      if (!Number.isFinite(val)) return null;
      const len = values.length;
      if (len === 0) return [0, 0, 0];

      if (renderMode === "discrete") {
        if (val <= values[0]) return colours[0];
        if (val >= values[len - 1]) return colours[len - 1];
        for (let i = 0; i < len; i++) {
          if (val <= values[i]) return colours[i];
        }
        return colours[len - 1];
      } else { // continuous (Interpolated)
        if (val <= values[0]) return colours[0];
        if (val >= values[len - 1]) return colours[len - 1];
        for (let i = 0; i < len - 1; i++) {
          if (val >= values[i] && val <= values[i + 1]) {
            const range = values[i + 1] - values[i];
            const factor = range > 1e-12 ? (val - values[i]) / range : 0;
            const c1 = colours[i];
            const c2 = colours[i + 1];
            return [
              Math.round(c1[0] + factor * (c2[0] - c1[0])),
              Math.round(c1[1] + factor * (c2[1] - c1[1])),
              Math.round(c1[2] + factor * (c2[2] - c1[2]))
            ];
          }
        }
        return colours[len - 1];
      }
    }

    let renderFrame = 0;
    function updateAndRender() {
      if (renderFrame) cancelAnimationFrame(renderFrame);
      renderFrame = requestAnimationFrame(() => {
        renderFrame = 0;
        renderNow();
      });
    }

    function renderNow() {
      if (!rasterInfo) return;

      const dataMin = rasterInfo.stats.minimum;
      const dataMax = rasterInfo.stats.maximum;
      let min = dataMin;
      let max = dataMax;

      let breakResult;
      try {
        if (chkManualLimits.checked) {
          const requestedMin = Number(manualMinInput.value);
          const requestedMax = Number(manualMaxInput.value);
          if (Number.isFinite(requestedMin)) min = requestedMin;
          if (Number.isFinite(requestedMax)) max = requestedMax;
        } else if (chkPercentiles.checked) {
          const requestedLow = Number(pctLowInput.value);
          const requestedHigh = Number(pctHighInput.value);
          const lowP = Number.isFinite(requestedLow) ? requestedLow : 2;
          const highP = Number.isFinite(requestedHigh) ? requestedHigh : 98;
          if (!(0 <= lowP && lowP < highP && highP <= 100)) return;
          const pctRange = computePercentileRangeQgis(
            rasterInfo.stats.percentileCounts,
            dataMin,
            dataMax,
            lowP,
            highP
          );
          min = pctRange.low;
          max = pctRange.high;
        }
        if (!(max > min)) {
          max = min + Math.max(1e-6, Math.abs(min) * 1e-6);
        }
        breakResult = calculateBreaksQgis(rasterInfo.sampleData, rasterInfo.stats, min, max);
      } catch (err) {
        console.error(err);
        return;
      }

      const stops = getActiveStops();
      const bins = breakResult.bins;
      const colours = Array.from({ length: bins }, (_, i) => interpolateColorHex(stops, i / Math.max(1, bins - 1)));

      drawRasterCanvas(rasterInfo.previewWidth, rasterInfo.previewHeight, rasterInfo.previewData, breakResult.values, colours, breakResult.renderMode);
      saveLayerView(rasterInfo,rasterCanvas);
      shading = {values:breakResult.values, colours, mode:breakResult.renderMode}; drawDetail(); renderComposition(); renderSources();
      drawHistogramAndBreaks(breakResult, stops, breakResult.counts, min, max);
    }

    function drawRasterCanvas(width, height, data, values, colours, renderMode, target = rasterCanvas) {
      const ctx = target.getContext("2d"); target.width = width; target.height = height;
      ctx.imageSmoothingEnabled = false;

      const imgData = ctx.createImageData(width, height);
      const pixels = imgData.data;

      for (let i = 0; i < data.length; i++) {
        const val = data[i];
        const idx = i * 4;
        const rgb = evaluateQgisShader(val, values, colours, renderMode);

        if (!rgb) {
          pixels[idx] = 0; pixels[idx + 1] = 0; pixels[idx + 2] = 0; pixels[idx + 3] = 0;
        } else {
          pixels[idx] = rgb[0];
          pixels[idx + 1] = rgb[1];
          pixels[idx + 2] = rgb[2];
          pixels[idx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    function drawHistogramAndBreaks(breakResult, stops, counts, min, max) {
      const histCanvas = document.getElementById("histogramCanvas");
      const hCtx = histCanvas.getContext("2d");
      histCanvas.width = histCanvas.offsetWidth || 500;
      histCanvas.height = histCanvas.offsetHeight || 150;

      hCtx.clearRect(0, 0, histCanvas.width, histCanvas.height);
      const maxCount = Math.max(...counts, 1);
      const barWidth = histCanvas.width / counts.length;

      for (let i = 0; i < counts.length; i++) {
        const h = (counts[i] / maxCount) * (histCanvas.height - 24);
        const x = i * barWidth;
        const y = histCanvas.height - 24 - h;
        hCtx.fillStyle = "rgba(14, 99, 156, 0.6)";
        hCtx.fillRect(x, y, barWidth + 0.5, h);
      }

      const { values, edges, bins } = breakResult;

      // Draw break lines
      values.forEach((brk, i) => {
        const pct = (brk - min) / (max - min || 1);
        const x = pct * histCanvas.width;
        const t = i / Math.max(1, bins - 1);
        const [r, g, b] = interpolateColorHex(stops, t);

        hCtx.strokeStyle = \`rgb(\${r},\${g},\${b})\`;
        hCtx.lineWidth = 1.5;
        hCtx.beginPath();
        hCtx.moveTo(x, 0);
        hCtx.lineTo(x, histCanvas.height - 24);
        hCtx.stroke();
      });

      // Table Breakdown
      const tbody = document.getElementById("breaksTableBody");
      tbody.innerHTML = "";
      for (let i = 0; i < values.length; i++) {
        const tr = document.createElement("tr");
        const t = i / Math.max(1, bins - 1);
        const [r, g, b] = interpolateColorHex(stops, t);
        const hexStr = \`#\${r.toString(16).padStart(2,"0")}\${g.toString(16).padStart(2,"0")}\${b.toString(16).padStart(2,"0")}\`;
        const lower = edges[i] !== undefined ? edges[i] : min;
        const upper = values[i];

        tr.innerHTML = \`
          <td>\${i + 1}</td>
          <td>\${lower.toPrecision(6)}</td>
          <td>\${upper.toPrecision(6)}</td>
          <td><div class="color-swatch" style="background-color: \${hexStr};"></div></td>
        \`;
        tbody.appendChild(tr);
      }
    }

    // Viewport Pan & Zoom Controls (Focal Point at Mouse Cursor)
    function updateTransform() {
      scheduleDetail();
      renderComposition();
      rasterCanvas.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${zoom})\`;
      try{document.getElementById("zoomOverlay").textContent = "Zoom: "+Math.round(zoom*pixelScale()*100)+"%";}catch{document.getElementById("zoomOverlay").textContent="CRS de origen pendiente";}
    }

    function resetTransform() {
      if (!rasterInfo) return;
      const vRect = viewport.getBoundingClientRect();
      if (vRect.width <= 0 || vRect.height <= 0) return;
      if(projectCrs){
        try{const box=projection.bounds(rasterInfo,projectCrs);
          zoom=Math.min(vRect.width*0.9/(box[2]-box[0]),vRect.height*0.9/(box[3]-box[1]));
          if(!Number.isFinite(zoom) || zoom<=0)return;
          panX=vRect.width/2-(box[0]+box[2])/2*zoom;panY=vRect.height/2+(box[1]+box[3])/2*zoom;
          viewInitialized=true;updateTransform();
        }catch(error){document.getElementById("projectCrsStatus").textContent=error.message;}
        return;
      }
      viewInitialized=true;
      const fitZoom = Math.min(
        (vRect.width * 0.9) / rasterInfo.previewWidth,
        (vRect.height * 0.9) / rasterInfo.previewHeight
      );
      zoom = Math.max(0.1, fitZoom);
      panX = (vRect.width - rasterInfo.previewWidth * zoom) / 2;
      panY = (vRect.height - rasterInfo.previewHeight * zoom) / 2;
      updateTransform();
    }

    viewport.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    });

    window.addEventListener("mousemove", (e) => {
      if (isDragging) {
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        updateTransform();
      }

      clearTimeout(probeTimer); probeId++;
      // Read raster pixel & real geospatial map coordinates under cursor
      if (rasterInfo) {
        const vRect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - vRect.left;
        const mouseY = e.clientY - vRect.top;

        let canvasX=(mouseX-panX)/zoom,canvasY=(mouseY-panY)/zoom;
        if(projectCrs){
          try{const pixel=projection.screenToPixel(rasterInfo,projectCrs,camera(),mouseX,mouseY);
            canvasX=pixel[0]*rasterInfo.previewWidth/rasterInfo.width;canvasY=pixel[1]*rasterInfo.previewHeight/rasterInfo.height;
          }catch{return;}
        }

        const px = Math.floor(canvasX);
        const py = Math.floor(canvasY);

        if (mouseX >= 0 && mouseY >= 0 && mouseX < vRect.width && mouseY < vRect.height && px >= 0 && px < rasterInfo.previewWidth && py >= 0 && py < rasterInfo.previewHeight) {
          const idx = py * rasterInfo.previewWidth + px;
          const val = rasterInfo.previewData[idx];

          const fullX = Math.min(rasterInfo.width-1, Math.floor(canvasX*rasterInfo.width/rasterInfo.previewWidth));
          const fullY = Math.min(rasterInfo.height-1, Math.floor(canvasY*rasterInfo.height/rasterInfo.previewHeight));
          const sourcePixelX = fullX, sourcePixelY = fullY;
          document.getElementById("posOverlay").textContent = "X: "+fullX+" Y: "+fullY;
          document.getElementById("valOverlay").textContent = (currentLang === "es" ? "Muestra: " : "Sample: ")+(Number.isFinite(val) ? val.toPrecision(6) : "NoData");
          const id = probeId;
          if (!isDragging) probeTimer = setTimeout(() => vscode.postMessage({type:"probe", id,
            sourceId:rasterInfo.sourceId, band:rasterInfo.activeBand, window:[fullX,fullY,fullX+1,fullY+1], width:1,height:1}), 100);

          if(projectCrs){
            document.getElementById("geoOverlay").textContent=projectCrs+" X: "+((mouseX-panX)/zoom).toFixed(4)+" Y: "+(-(mouseY-panY)/zoom).toFixed(4);
          } else if (rasterInfo.geo && rasterInfo.geo.hasGeo && rasterInfo.geo.transform) {
            const [realX, realY] = rasterPixelToModel(
              rasterInfo.geo.transform,
              sourcePixelX,
              sourcePixelY,
              rasterInfo.geo.pixelIsArea
            );

            if (rasterInfo.geo.isGeographic) {
              document.getElementById("geoOverlay").textContent = \`\${I18N[currentLang].coord}: Lon: \${realX.toFixed(6)}° Lat: \${realY.toFixed(6)}°\`;
            } else {
              document.getElementById("geoOverlay").textContent = \`\${I18N[currentLang].coord}: E: \${realX.toFixed(2)} N: \${realY.toFixed(2)}\`;
            }
          } else {
            document.getElementById("geoOverlay").textContent = \`\${I18N[currentLang].coord}: \${I18N[currentLang].no_crs}\`;
          }
        }
      }
    });

    window.addEventListener("mouseup", () => { isDragging = false; });

    viewport.addEventListener("mouseleave", () => {
      clearTimeout(probeTimer); probeId++;
      for (const name of ["valOverlay","posOverlay","geoOverlay"]) document.getElementById(name).textContent = "-";
    });
    new ResizeObserver(() => { if (rasterInfo) {if(viewInitialized)updateTransform();else resetTransform();} }).observe(viewport);
    // Focal Point Zoom at Mouse Cursor Position
    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const vRect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - vRect.left;
      const mouseY = e.clientY - vRect.top;

      // Canvas point currently under mouse cursor
      const canvasX = (mouseX - panX) / zoom;
      const canvasY = (mouseY - panY) / zoom;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.min(1e12, Math.max(1e-12, zoom * zoomFactor));

      // Keep (canvasX, canvasY) locked under (mouseX, mouseY)
      panX = mouseX - canvasX * newZoom;
      panY = mouseY - canvasY * newZoom;
      zoom = newZoom;

      updateTransform();
    });

    document.getElementById("btnNativeZoom").addEventListener("click", () => {
      if (!rasterInfo) return;
      const rect = viewport.getBoundingClientRect();
      const cx = (rect.width/2-panX)/zoom, cy = (rect.height/2-panY)/zoom;
      try{zoom=1/pixelScale();}catch{return;}
      panX = rect.width/2-cx*zoom; panY = rect.height/2-cy*zoom;
      updateTransform();
    });
    document.getElementById("btnResetView").addEventListener("click", resetTransform);

    // Tabs
    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.getAttribute("data-tab")).classList.add("active");
      });
    });

    // Export PNG
    document.getElementById("btnExportPng").addEventListener("click", () => {
      if (!rasterInfo) return;
      vscode.postMessage({
        type: "savePng", sourceId:rasterInfo.sourceId,
        dataUrl: compositionCanvas.toDataURL("image/png")
      });
    });

    // Send ready handshake to extension host once scripts are loaded
    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
