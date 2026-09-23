import * as path from 'path';
import * as vscode from 'vscode';
import { loadGeoTiffBand, readGeoTiffWindow } from './geoTiffLoader';
import { getWebviewContent } from './webviewContent';

class GeoTiffDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}
  dispose(): void {}
}

export class GeoRampEditorProvider implements vscode.CustomReadonlyEditorProvider<GeoTiffDocument> {
  static readonly viewType = 'georamp.viewer';

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      GeoRampEditorProvider.viewType,
      new GeoRampEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<GeoTiffDocument> {
    return new GeoTiffDocument(uri);
  }

  async resolveCustomEditor(
    document: GeoTiffDocument,
    panel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    panel.webview.options = { enableScripts: true };
    panel.webview.html = getWebviewContent(
      panel.webview,
      this.context.extensionUri,
      path.basename(document.uri.fsPath) || 'Raster'
    );

    const sources = new Map<string, vscode.Uri>([[document.uri.toString(), document.uri]]);
    let sourceId = document.uri.toString();
    let sourceUri = document.uri;
    const sendSources = () => panel.webview.postMessage({ type: 'sources', activeId: sourceId,
      sources: [...sources].map(([id, uri]) => ({ id, name: path.basename(uri.fsPath), path: uri.fsPath })) });
    const savedPreferences=this.context.globalState?.get<any>("georamp.preferences");
    let activeBand = Number.isInteger(savedPreferences?.band) ? Math.max(0,savedPreferences.band) : 0;
    let batchController: AbortController | undefined;
    let sequence = 0;
    let disposed = false;
    let controller: AbortController | undefined;
    const layerControllers = new Map<string, AbortController>();
    const auxiliary = new Map<string, AbortController>();
    const cache = new Map<string, Awaited<ReturnType<typeof readGeoTiffWindow>>>();
    const cancelCurrent = () => {
      controller?.abort();
      auxiliary.forEach(value => value.abort());
      auxiliary.clear();
      cache.clear();
    };
    panel.onDidDispose(() => {
      disposed = true;
      batchController?.abort();
      layerControllers.forEach(c => c.abort());
      cancelCurrent();
    });
    token.onCancellationRequested(cancelCurrent);

    const loadAndSend = async (band: number): Promise<void> => {
      if (sourceUri.scheme !== 'file') {
        await panel.webview.postMessage({
          type: 'error',
          message: 'GeoRamp actualmente requiere un archivo GeoTIFF local.',
        });
        return;
      }

      cancelCurrent();
      const loadingId = sourceId;
      const loadingUri = sourceUri;
      controller = new AbortController();
      const request = ++sequence;
      await panel.webview.postMessage({ type: 'loading', band, sourceId: loadingId });
      try {
        const configured = vscode.workspace
          .getConfiguration('georamp')
          .get<number>('previewMaxDimension', 1400);
        const maxDimension = Math.min(4096, Math.max(512, configured));
        const data = await loadGeoTiffBand(
          loadingUri.fsPath,
          band,
          maxDimension,
          controller.signal
        );
        if (disposed || request !== sequence) return;
        activeBand = data.activeBand;
        await panel.webview.postMessage({
          type: 'init',
          data: {
            sourceId: loadingId, fileName: path.basename(loadingUri.fsPath),
            width: data.width,
            height: data.height,
            bandCount: data.bandCount,
            activeBand: data.activeBand,
            stats: data.stats,
            geo: data.geo,
            previewWidth: data.previewWidth,
            previewHeight: data.previewHeight,
            previewDataBuffer: data.previewData.buffer,
            sampleDataBuffer: data.sampleData.buffer,
          },
        });
      } catch (error) {
        if (controller.signal.aborted || disposed || request !== sequence) return;
        const message = error instanceof Error ? error.message : String(error);
        await panel.webview.postMessage({ type: 'error', message });
      }
    };

    panel.webview.onDidReceiveMessage(async (message: any) => {
      if (message?.type === 'savePreferences' && message.preferences && typeof message.preferences === 'object') {
        // Bound persisted data; never store source pixels or file contents here.
        if (JSON.stringify(message.preferences).length < 150000) {
          const preferences={...message.preferences,band:activeBand};
          await this.context.globalState?.update('georamp.preferences',preferences);
        }
      } else if (message?.type === 'saveQml' && sources.has(sourceId) && message.sourceId === sourceId
          && typeof message.text === 'string' && message.text.length < 150000) {
        try {
          const baseName=path.basename(sourceUri.fsPath,path.extname(sourceUri.fsPath));
          const target=await vscode.window.showSaveDialog({defaultUri:vscode.Uri.file(path.join(path.dirname(sourceUri.fsPath),baseName+'-georamp.qml')),filters:{QML:['qml']}});
          if(target){await vscode.workspace.fs.writeFile(target,Buffer.from(message.text,'utf8'));
            await panel.webview.postMessage({type:'styleSaved',message:'QML: '+path.basename(target.fsPath)});}
        }catch(error){await panel.webview.postMessage({type:'styleError',message:error instanceof Error ? error.message : String(error)});}
      } else if (message?.type === 'cancelBatch') {
        batchController?.abort();
      } else if (message?.type === 'batchPreview' && Number.isInteger(message.request)) {
        batchController?.abort();
        const abort=new AbortController();batchController=abort;
        try {
          const uri=sources.get(message.id);
          if(!uri || !Number.isInteger(message.band) || message.band<0)throw new Error('Invalid layer or band');
          const data=await loadGeoTiffBand(uri.fsPath,message.band,512,abort.signal);
          if(data.activeBand!==message.band)throw new Error('Requested band is unavailable');
          if(disposed || abort.signal.aborted)return;
          if(!sources.has(message.id))throw new Error('Layer removed');
          await panel.webview.postMessage({type:'batchPreview',request:message.request,data:{...data,sourceId:message.id,
            previewData:undefined,sampleData:undefined,previewDataBuffer:data.previewData.buffer,sampleDataBuffer:data.sampleData.buffer}});
        }catch(error){if(!disposed && !abort.signal.aborted)await panel.webview.postMessage({type:'batchError',request:message.request,message:error instanceof Error ? error.message : String(error)});}
      } else if (message?.type === 'ready') {
        const restoredBand=message.bands?.[sourceId];
        if(Number.isInteger(restoredBand) && restoredBand>=0)activeBand=restoredBand;
        await panel.webview.postMessage({type:'preferences',preferences:savedPreferences || {}});
        await sendSources();
        await loadAndSend(activeBand);
      } else if (message?.type === 'layerPreview' && sources.has(message.id)) {
        const id = message.id as string;
        layerControllers.get(id)?.abort();
        const abort = new AbortController(); layerControllers.set(id, abort);
        try {
          const data = await loadGeoTiffBand(sources.get(id)!.fsPath, Number.isInteger(message.band) ? message.band : 0, 512, abort.signal);
          if (disposed || abort.signal.aborted || !sources.has(id)) return;
          await panel.webview.postMessage({type:'layerPreview', id,
            data:{...data, sourceId:id, previewData:undefined, sampleData:undefined,
              previewDataBuffer:data.previewData.buffer,sampleDataBuffer:data.sampleData.buffer}});
        } catch (error) {
          if (!disposed && !abort.signal.aborted) await panel.webview.postMessage({type:'layerError',id,
            message:error instanceof Error ? error.message : String(error)});
        } finally { if (layerControllers.get(id) === abort) layerControllers.delete(id); }
      } else if (message?.type === 'importSources') {
        const picked = await vscode.window.showOpenDialog({ canSelectMany: true,
          filters: { GeoTIFF: ['tif', 'tiff'] }, openLabel: 'Importar rasters' });
        if (disposed || !picked?.length) return;
        for (const uri of picked) if (uri.scheme === 'file') sources.set(uri.toString(), uri);
        if (!sources.has(sourceId)) {
          const first = sources.entries().next().value;
          if (first) { [sourceId, sourceUri] = first; activeBand = 0; }
          await sendSources();
          if (first) await loadAndSend(0);
        } else { await sendSources(); }
      } else if (message?.type === 'selectSource' && sources.has(message.id)) {
        sourceId = message.id; sourceUri = sources.get(sourceId)!; activeBand = Number.isInteger(message.band) && message.band>=0 ? message.band : 0;
        await sendSources();
        await loadAndSend(activeBand);
      } else if (message?.type === 'removeSource' && sources.has(message.id)) {
        layerControllers.get(message.id)?.abort();
        sources.delete(message.id);
        if (message.id === sourceId) {
          cancelCurrent(); sequence++;
          const next = sources.entries().next().value;
          if (next) {
            [sourceId, sourceUri] = next; activeBand = 0;
            await sendSources(); await loadAndSend(0);
          } else {
            sourceId = '';
            await sendSources(); await panel.webview.postMessage({ type: 'empty' });
          }
        } else { await sendSources(); }
      } else if (message?.type === 'changeBand' && sources.has(sourceId) && message.sourceId === sourceId && Number.isInteger(message.band)) {
        await loadAndSend(message.band);
      } else if ((message?.type === 'detail' || message?.type === 'probe')
        && sources.has(sourceId) && message.sourceId === sourceId && sourceUri.scheme === 'file' && message.band === activeBand
        && Array.isArray(message.window) && Number.isInteger(message.id)) {
        const kind = message.type as string;
        auxiliary.get(kind)?.abort();
        const requestController = new AbortController();
        auxiliary.set(kind, requestController);
        const generation = sequence;
        try {
          const key = JSON.stringify([activeBand, message.window, message.width, message.height]);
          const result = cache.get(key) ?? await readGeoTiffWindow(sourceUri.fsPath,
            activeBand, message.window, message.width, message.height, requestController.signal);
          if (disposed || requestController.signal.aborted || generation !== sequence) return;
          if (kind === 'detail') {
            cache.set(key, result);
            while (cache.size > 2) cache.delete(cache.keys().next().value!);
          }
          await panel.webview.postMessage({ type: kind, id: message.id, band: activeBand,
            ...result, data: undefined, buffer: result.data.buffer });
        } catch (error) {
          if (!disposed && !requestController.signal.aborted && generation === sequence) {
            await panel.webview.postMessage({ type: 'detailError', kind, id: message.id,
              message: error instanceof Error ? error.message : String(error) });
          }
        }
      } else if (message?.type === 'savePng' && sources.has(sourceId) && message.sourceId === sourceId && typeof message.dataUrl === 'string') {
        await savePng(message.dataUrl, sourceUri);
      }
    });
  }
}

async function savePng(dataUrl: string, source: vscode.Uri): Promise<void> {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    void vscode.window.showErrorMessage('GeoRamp recibió una imagen PNG no válida.');
    return;
  }
  const baseName = path.basename(source.fsPath, path.extname(source.fsPath));
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(path.dirname(source.fsPath), `${baseName}-georamp.png`)),
    filters: { PNG: ['png'] },
  });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, Buffer.from(match[1], 'base64'));
  void vscode.window.showInformationMessage(`GeoRamp guardó ${path.basename(target.fsPath)}.`);
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(GeoRampEditorProvider.register(context));
  context.subscriptions.push(
    vscode.commands.registerCommand('georamp.openPreview', async (uri?: vscode.Uri) => {
      let target = uri;
      if (!target) {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { GeoTIFF: ['tif', 'tiff'] },
          openLabel: 'Abrir con GeoRamp',
        });
        target = picked?.[0];
      }
      if (target) {
        await vscode.commands.executeCommand('vscode.openWith', target, GeoRampEditorProvider.viewType);
      }
    })
  );
}

export function deactivate(): void {}
