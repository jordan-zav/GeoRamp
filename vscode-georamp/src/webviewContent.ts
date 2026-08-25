import * as vscode from 'vscode';
import { BUILTIN_PALETTES } from './palettes';

export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  fileName: string
): string {
  const nonce = getNonce();
  const palettesJson = JSON.stringify(BUILTIN_PALETTES);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
      background-color: #20242b;
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
    }

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
  </style>
</head>
<body>
  <header>
    <h1>
      <span id="titleText">GeoRamp - Visor GeoTIFF</span>
    </h1>
    <div class="header-actions">
      <select id="langSelect" style="width: 90px;">
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
      <button class="btn btn-secondary" id="btnExportPng"><span data-i18n="export_png">Exportar PNG</span></button>
      <button class="btn btn-secondary" id="btnResetView"><span data-i18n="reset_zoom">Reset Zoom</span></button>
    </div>
  </header>

  <div class="main-container">
    <div class="sidebar">

      <!-- 1. DATOS -->
      <div class="section-card">
        <div class="section-title"><span data-i18n="sec_data">1. Datos</span></div>
        <div class="form-group">
          <label data-i18n="band">Banda:</label>
          <select id="bandSelect"></select>
        </div>
        <div class="stats-bar" id="statsBar">Cargando datos...</div>
      </div>

      <!-- 2. RAMPA DE COLOR -->
      <div class="section-card">
        <div class="section-title"><span data-i18n="sec_ramp">2. Rampa de color</span></div>
        <div class="ramp-controls">
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
            </select>
          </div>
        </div>
        <div class="ramp-grid" id="rampGrid"></div>
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

    </div>

    <!-- MAIN VIEWER -->
    <div class="content-area">
      <div class="tabs">
        <div class="tab active" data-tab="viewerTab" data-i18n="tab_viewer">Visor en tiempo real</div>
        <div class="tab" data-tab="breaksTab" data-i18n="tab_breaks">Histograma y Cortes</div>
      </div>

      <div class="tab-content active" id="viewerTab">
        <div class="viewport" id="viewport">
          <canvas id="rasterCanvas"></canvas>
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
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const BUILTIN_PALETTES = ${palettesJson};

    // Dictionary
    const I18N = {
      es: {
        title: "GeoRamp - Visor GeoTIFF",
        export_png: "Exportar PNG",
        reset_zoom: "Reset Zoom",
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
      },
      en: {
        title: "GeoRamp - GeoTIFF Viewer",
        export_png: "Export PNG",
        reset_zoom: "Reset Zoom",
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

    // Init messaging
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "init") {
        rasterInfo = message.data;
        rasterInfo.previewData = new Float32Array(message.data.previewData.map(v => v === null ? NaN : v));
        initBandSelect();
        updateStatsUI();
        renderRampGrid();
        updateActiveRampBar();
        updateAndRender();
        resetTransform();
      }
    });

    langSelect.addEventListener("change", (e) => {
      currentLang = e.target.value;
      updateLanguage();
    });

    function updateLanguage() {
      const dict = I18N[currentLang];
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) el.textContent = dict[key];
      });
      renderRampGrid();
    }

    function initBandSelect() {
      const bandSelect = document.getElementById("bandSelect");
      bandSelect.innerHTML = "";
      for (let i = 0; i < rasterInfo.bandCount; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = \`Banda \${i + 1}\`;
        if (i === rasterInfo.activeBand) opt.selected = true;
        bandSelect.appendChild(opt);
      }
      bandSelect.addEventListener("change", (e) => {
        vscode.postMessage({ type: "changeBand", band: parseInt(e.target.value) });
      });
    }

    function updateStatsUI() {
      const s = rasterInfo.stats;
      const geo = rasterInfo.geo;
      let geoHtml = "";
      if (geo && geo.hasGeo && geo.bbox) {
        const [minX, minY, maxX, maxY] = geo.bbox;
        geoHtml = \`<br/>SRC: <b>\${geo.crs}</b><br/>BBOX: E[\${minX.toFixed(2)}, \${maxX.toFixed(2)}] N[\${minY.toFixed(2)}, \${maxY.toFixed(2)}]\`;
      } else {
        geoHtml = \`<br/>SRC: <b>\${geo ? geo.crs : "Sin CRS"}</b>\`;
      }

      document.getElementById("statsBar").innerHTML =
        \`Mín: <b>\${s.minimum.toPrecision(6)}</b> | Máx: <b>\${s.maximum.toPrecision(6)}</b><br/>\` +
        \`Media: <b>\${s.mean.toPrecision(6)}</b> | Desv: <b>\${s.stddev.toPrecision(6)}</b><br/>\` +
        \`NoData: <b>\${s.noDataValue !== null ? s.noDataValue : "Ninguno"}</b>\` +
        geoHtml;

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
    }

    function makeGradientCss(stops, reversed) {
      const activeStops = reversed ? stops.slice().reverse() : stops;
      const str = activeStops.map((s, i) => {
        const pos = (i / (activeStops.length - 1)) * 100;
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
      manualMinInput.disabled = !e.target.checked;
      manualMaxInput.disabled = !e.target.checked;
      updateAndRender();
    });
    manualMinInput.addEventListener("input", updateAndRender);
    manualMaxInput.addEventListener("input", updateAndRender);

    chkPercentiles.addEventListener("change", (e) => {
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

      const sampleStep = Math.max(1, Math.floor(data.length / 250000));
      for (let i = 0; i < data.length; i += sampleStep) {
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
      const bins = parseInt(numBinsInput.value) || 39;
      const method = distSelect.value;
      const sigma = parseFloat(sigmaInput.value) || 2;
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

    function updateAndRender() {
      if (!rasterInfo) return;

      const dataMin = rasterInfo.stats.minimum;
      const dataMax = rasterInfo.stats.maximum;
      let min = dataMin;
      let max = dataMax;

      if (chkManualLimits.checked) {
        min = parseFloat(manualMinInput.value) || min;
        max = parseFloat(manualMaxInput.value) || max;
      } else if (chkPercentiles.checked) {
        const lowP = parseFloat(pctLowInput.value) || 2;
        const highP = parseFloat(pctHighInput.value) || 98;
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

      let breakResult;
      try {
        breakResult = calculateBreaksQgis(rasterInfo.previewData, rasterInfo.stats, min, max);
      } catch (err) {
        console.error(err);
        return;
      }

      const stops = isReversed ? selectedPalette.stops.slice().reverse() : selectedPalette.stops;
      const bins = breakResult.bins;
      const colours = Array.from({ length: bins }, (_, i) => interpolateColorHex(stops, i / Math.max(1, bins - 1)));

      drawRasterCanvas(rasterInfo.previewWidth, rasterInfo.previewHeight, rasterInfo.previewData, breakResult.values, colours, breakResult.renderMode);
      drawHistogramAndBreaks(breakResult, stops, breakResult.counts, min, max);
    }

    function drawRasterCanvas(width, height, data, values, colours, renderMode) {
      rasterCanvas.width = width;
      rasterCanvas.height = height;
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
      rasterCanvas.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${zoom})\`;
      document.getElementById("zoomOverlay").textContent = \`Zoom: \${Math.round(zoom * 100)}%\`;
    }

    function resetTransform() {
      if (!rasterInfo) return;
      const vRect = viewport.getBoundingClientRect();
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

      // Read raster pixel & real geospatial map coordinates under cursor
      if (rasterInfo) {
        const vRect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - vRect.left;
        const mouseY = e.clientY - vRect.top;

        const canvasX = (mouseX - panX) / zoom;
        const canvasY = (mouseY - panY) / zoom;

        const px = Math.floor(canvasX);
        const py = Math.floor(canvasY);

        if (px >= 0 && px < rasterInfo.previewWidth && py >= 0 && py < rasterInfo.previewHeight) {
          const idx = py * rasterInfo.previewWidth + px;
          const val = rasterInfo.previewData[idx];

          const fullX = Math.floor((px / rasterInfo.previewWidth) * rasterInfo.width);
          const fullY = Math.floor((py / rasterInfo.previewHeight) * rasterInfo.height);

          document.getElementById("posOverlay").textContent = \`Píxel: X: \${fullX} Y: \${fullY}\`;
          document.getElementById("valOverlay").textContent = \`Valor: \${Number.isFinite(val) ? val.toPrecision(6) : "NoData"}\`;

          if (rasterInfo.geo && rasterInfo.geo.hasGeo && rasterInfo.geo.bbox) {
            const [minX, minY, maxX, maxY] = rasterInfo.geo.bbox;
            const fracX = px / (rasterInfo.previewWidth - 1 || 1);
            const fracY = py / (rasterInfo.previewHeight - 1 || 1);

            const realX = minX + fracX * (maxX - minX);
            const realY = maxY - fracY * (maxY - minY);

            const isGeographic = (rasterInfo.geo.epsg === 4326) || (minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90);
            if (isGeographic) {
              document.getElementById("geoOverlay").textContent = \`Coord: Lon: \${realX.toFixed(6)}° Lat: \${realY.toFixed(6)}°\`;
            } else {
              document.getElementById("geoOverlay").textContent = \`Coord: E: \${realX.toFixed(2)} N: \${realY.toFixed(2)}\`;
            }
          } else {
            document.getElementById("geoOverlay").textContent = "Coord: Sin CRS";
          }
        }
      }
    });

    window.addEventListener("mouseup", () => { isDragging = false; });

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
      const newZoom = Math.min(50, Math.max(0.05, zoom * zoomFactor));

      // Keep (canvasX, canvasY) locked under (mouseX, mouseY)
      panX = mouseX - canvasX * newZoom;
      panY = mouseY - canvasY * newZoom;
      zoom = newZoom;

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
      const link = document.createElement("a");
      link.download = "georamp_export.png";
      link.href = rasterCanvas.toDataURL("image/png");
      link.click();
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
