const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.argv[2] || 9333);
const screenshotPath = process.argv[3] || path.join(process.env.TEMP || '.', 'georamp-live-ui.png');

function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let requestId = 0;
  const pending = new Map();
  const exceptions = [];
  const contexts = [];

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.text);
    } else if (message.method === 'Runtime.executionContextCreated') {
      contexts.push(message.params.context);
    }
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  async function call(method, params = {}) {
    await ready;
    const id = ++requestId;
    const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    socket.send(JSON.stringify({ id, method, params }));
    return response;
  }

  async function evaluate(expression, contextId) {
    const response = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      ...(contextId ? { contextId } : {}),
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result.value;
  }

  return { socket, call, evaluate, exceptions, contexts };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const requestedTarget = process.argv.find(arg => arg.startsWith('--webview='))?.slice('--webview='.length);
  const webviewTarget = targets.find((target) =>
    (!requestedTarget || target.id === requestedTarget) &&
    target.type === 'iframe' && target.url.includes('extensionId=jordanzav.georamp')
  );
  const pageTarget = targets.find((target) => target.type === 'page');
  assert(webviewTarget, 'GeoRamp webview target was not found.');
  assert(pageTarget, 'VS Code page target was not found.');

  if (process.argv.includes('--close')) {
    const page = connect(pageTarget);
    await page.call('Browser.close');
    console.log('VS Code isolated test instance closed');
    return;
  }

  if (process.argv.includes('--reload')) {
    const page = connect(pageTarget);
    await page.call('Runtime.evaluate', { expression: 'location.reload()' });
    page.socket.close();
    console.log('VS Code test window reloaded');
    return;
  }

  const webview = connect(webviewTarget);
  await webview.call('Runtime.enable');
  await new Promise((resolve) => setTimeout(resolve, 200));
  let appContext;
  for (const context of webview.contexts.filter((candidate) => candidate.auxData?.isDefault)) {
    const hasRasterCanvas = await webview.evaluate(
      `Boolean(document.getElementById('rasterCanvas'))`,
      context.id,
    ).catch(() => false);
    if (hasRasterCanvas) {
      appContext = context;
      break;
    }
  }
  assert(appContext, `GeoRamp application context was not found among ${webview.contexts.length} contexts.`);
  const evaluate = (expression) => webview.evaluate(expression, appContext.id);
  if (process.argv.includes('--inspect')) {
    const state = await evaluate(`({
      rasterInfoType: typeof rasterInfo,
      hasRasterInfo: typeof rasterInfo !== 'undefined' && Boolean(rasterInfo),
      statusHidden: statusOverlay.hidden,
      statusText: statusOverlay.textContent,
      bodyText: document.body.innerText.slice(0, 500),
      canvasWidth: rasterCanvas.width,
      canvasHeight: rasterCanvas.height,
      style: captureStyle(), language:currentLang, band:rasterInfo?.activeBand
    })`);
    webview.socket.close();
    console.log(JSON.stringify(state, null, 2));
    return;
  }
  await evaluate(`new Promise((resolve, reject) => {
    const deadline = Date.now() + 30000;
    const check = () => {
      if (typeof rasterInfo !== 'undefined' && rasterInfo && !statusOverlay.hidden) {
        if (statusOverlay.textContent && !/cargando|loading/i.test(statusOverlay.textContent)) {
          reject(new Error(statusOverlay.textContent));
          return;
        }
      }
      if (typeof rasterInfo !== 'undefined' && rasterInfo && statusOverlay.hidden) resolve(true);
      else if (Date.now() > deadline) reject(new Error('Timed out waiting for rasterInfo'));
      else setTimeout(check, 100);
    };
    check();
  })`);

  const initial = await evaluate(`(() => {
    const canvas = document.getElementById('rasterCanvas');
    const context = canvas.getContext('2d');
    const probes = [
      [0, 0],
      [Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)],
      [Math.max(0, canvas.width - 1), Math.max(0, canvas.height - 1)]
    ];
    return {
      width: rasterInfo.width,
      height: rasterInfo.height,
      previewWidth: rasterInfo.previewWidth,
      previewHeight: rasterInfo.previewHeight,
      validCount: rasterInfo.stats.validCount,
      minimum: rasterInfo.stats.minimum,
      maximum: rasterInfo.stats.maximum,
      bandCount: rasterInfo.bandCount,
      hasGeo: rasterInfo.geo.hasGeo,
      transform: rasterInfo.geo.transform,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      visibleProbe: probes.some(([x, y]) => context.getImageData(x, y, 1, 1).data[3] > 0),
      statsText: document.getElementById('statsBar').textContent,
      statusHidden: statusOverlay.hidden
    };
  })()`);
  assert(initial.width > 0 && initial.height > 0, 'Invalid raster dimensions.');
  assert(initial.previewWidth === initial.canvasWidth && initial.previewHeight === initial.canvasHeight, 'Canvas dimensions do not match preview.');
  assert(initial.validCount > 0 && Number.isFinite(initial.minimum) && Number.isFinite(initial.maximum), 'Invalid raster statistics.');
  assert(initial.visibleProbe, 'Raster canvas did not render visible pixels.');
  assert(initial.hasGeo && Array.isArray(initial.transform), 'GeoTIFF affine transform was not loaded.');
  assert(initial.statusHidden, 'Status overlay still reports a loading or error state.');

  const palette = await evaluate(`(() => {
    selectedPalette = parseRgbTable('0,0,0,255\\n10,0,255,0\\n100,255,0,0', 'ui-test.csv');
    isReversed = false;
    const forward = getActiveStops();
    isReversed = true;
    const reversed = getActiveStops();
    isReversed = false;
    updateActiveRampBar();
    updateAndRender();
    return {
      forward: forward.map((stop) => stop.position),
      reversed: reversed.map((stop) => stop.position),
      reversedColours: reversed.map((stop) => stop.color)
    };
  })()`);
  assert(JSON.stringify(palette.forward) === JSON.stringify([0, 0.1, 1]), 'Imported ramp positions were not preserved.');
  assert(JSON.stringify(palette.reversed) === JSON.stringify([0, 0.9, 1]), 'Reversed ramp positions were not mirrored.');

  const controls = await evaluate(`(() => {
    distSelect.value = 'normal';
    numBinsInput.value = '17';
    renderModeSelect.value = 'discrete';
    chkPercentiles.checked = true;
    chkManualLimits.checked = false;
    pctLowInput.value = '2';
    pctHighInput.value = '98';
    renderNow();
    const beforeZoom = zoom;
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 300, clientY: 300 }));
    const zoomChanged = zoom > beforeZoom;
    langSelect.value = 'en';
    langSelect.dispatchEvent(new Event('change'));
    const distributionRows = {};
    for (const method of ['linear', 'normal', 'equal_area', 'log_linear']) {
      distSelect.value = method;
      chkShiftLog.checked = true;
      renderNow();
      distributionRows[method] = document.querySelectorAll('#breaksTableBody tr').length;
    }
    rampCategorySelect.value = 'all';
    rampSearch.value = 'viridis';
    renderRampGrid();
    const filteredRamps = rampGrid.querySelectorAll('.ramp-item').length;
    rampSearch.value = '';
    renderRampGrid();
    document.querySelector('[data-tab="breaksTab"]').click();
    const breaksTabActive = document.getElementById('breaksTab').classList.contains('active');
    const zoomBeforeHiddenReset = zoom;
    resetTransform();
    const hiddenResetPreserved = zoom === zoomBeforeHiddenReset;
    document.querySelector('[data-tab="viewerTab"]').click();
    resetTransform();
    const viewportRect = viewport.getBoundingClientRect();
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: viewportRect.left + viewportRect.width / 2,
      clientY: viewportRect.top + viewportRect.height / 2
    }));
    document.querySelector('[data-tab="breaksTab"]').click();
    return {
      rows: document.querySelectorAll('#breaksTableBody tr').length,
      canvasWidth: rasterCanvas.width,
      canvasHeight: rasterCanvas.height,
      zoomChanged,
      language: currentLang,
      title: document.getElementById('titleText').textContent,
      statusHidden: statusOverlay.hidden,
      distributionRows,
      filteredRamps,
      breaksTabActive,
      hiddenResetPreserved,
      geoOverlay: document.getElementById('geoOverlay').textContent,
      pngDataUrlValid: rasterCanvas.toDataURL('image/png').startsWith('data:image/png;base64,')
    };
  })()`);
  assert(controls.rows === 17, `Expected 17 break rows, received ${controls.rows}.`);
  assert(controls.canvasWidth > 0 && controls.canvasHeight > 0, 'Canvas disappeared after changing controls.');
  assert(controls.zoomChanged, 'Mouse-wheel zoom did not change the zoom level.');
  assert(controls.language === 'en' && /Viewer/i.test(controls.title), 'Language switch did not update the interface.');
  assert(controls.statusHidden, 'An error overlay appeared after changing controls.');
  assert(Object.values(controls.distributionRows).every((rows) => rows === 17), 'One or more distributions failed to render 17 breaks.');
  assert(controls.filteredRamps === 1, `Ramp search returned ${controls.filteredRamps} results instead of one.`);
  assert(controls.breaksTabActive, 'Histogram and breaks tab did not activate.');
  assert(controls.hiddenResetPreserved, 'Reset Zoom changed zoom while the viewer was hidden.');
  assert(/^(Coord: E:|EPSG:\d+ X:)/.test(controls.geoOverlay), `Projected coordinate overlay is invalid: ${controls.geoOverlay}`);
  assert(controls.pngDataUrlValid, 'PNG export payload could not be generated.');

  const qgisFeatures = await evaluate(`(async () => {
    const histogram=document.getElementById('histogramSummary').textContent;
    const sigma=document.getElementById('sigmaSummary').textContent;
    const exported=exportQml(lastRenderedStyle,false),parsed=parseQml(exported,DOMParser);
    document.getElementById('batchAll').click();document.getElementById('batchApply').click();
    const deadline=Date.now()+30000;
    while(batchJob && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
    if(batchJob)throw new Error('Batch did not finish');
    return {histogram,sigma,qmlStops:parsed.values.length,mode:parsed.mode,
      batch:document.getElementById('batchStatus').textContent,
      persisted:Boolean(vscode.getState().sourceStyles[rasterInfo.sourceId+':'+rasterInfo.activeBand])};
  })()`);
  assert(/Median:/.test(qgisFeatures.histogram), 'Histogram median is missing');
  assert(/all valid samples/.test(qgisFeatures.sigma), 'Observed sigma coverage is missing');
  assert(qgisFeatures.qmlStops === 17 && qgisFeatures.mode === 'discrete', 'QML stopped matching the visible style');
  assert(/1\/1 applied/.test(qgisFeatures.batch), 'Real batch read did not apply the style');
  assert(qgisFeatures.persisted, 'Style was not persisted in webview state');

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert(webview.exceptions.length === 0, `Webview exceptions: ${webview.exceptions.join('; ')}`);

  const page = connect(pageTarget);
  await page.call('Page.enable');
  await page.call('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27,
  });
  await page.call('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const histogramScreenshotPath = screenshotPath.replace(/\.png$/i, '-histogram.png');
  const histogramScreenshot = await page.call('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(histogramScreenshotPath, Buffer.from(histogramScreenshot.data, 'base64'));
  const viewerActive = await evaluate(`(() => {
    document.querySelector('[data-tab="viewerTab"]').click();
    return document.getElementById('viewerTab').classList.contains('active');
  })()`);
  assert(viewerActive, 'Live Viewer tab did not activate.');
  await new Promise((resolve) => setTimeout(resolve, 150));
  const viewerScreenshot = await page.call('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(screenshotPath, Buffer.from(viewerScreenshot.data, 'base64'));

  webview.socket.close();
  page.socket.close();
  console.log(JSON.stringify({
    initial, palette, controls, qgisFeatures, screenshotPath, histogramScreenshotPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
