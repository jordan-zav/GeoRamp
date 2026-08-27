import * as path from 'path';
import * as vscode from 'vscode';
import { loadGeoTiffBand } from './geoTiffLoader';
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

    let activeBand = 0;
    let sequence = 0;
    let disposed = false;
    let controller: AbortController | undefined;
    const cancelCurrent = () => controller?.abort();
    panel.onDidDispose(() => {
      disposed = true;
      cancelCurrent();
    });
    token.onCancellationRequested(cancelCurrent);

    const loadAndSend = async (band: number): Promise<void> => {
      if (document.uri.scheme !== 'file') {
        await panel.webview.postMessage({
          type: 'error',
          message: 'GeoRamp actualmente requiere un archivo GeoTIFF local.',
        });
        return;
      }

      cancelCurrent();
      controller = new AbortController();
      const request = ++sequence;
      await panel.webview.postMessage({ type: 'loading', band });
      try {
        const configured = vscode.workspace
          .getConfiguration('georamp')
          .get<number>('previewMaxDimension', 1400);
        const maxDimension = Math.min(4096, Math.max(512, configured));
        const data = await loadGeoTiffBand(
          document.uri.fsPath,
          band,
          maxDimension,
          controller.signal
        );
        if (disposed || request !== sequence) return;
        activeBand = data.activeBand;
        const bytes = Buffer.from(
          data.previewData.buffer,
          data.previewData.byteOffset,
          data.previewData.byteLength
        );
        const sampleBytes = Buffer.from(
          data.sampleData.buffer,
          data.sampleData.byteOffset,
          data.sampleData.byteLength
        );
        await panel.webview.postMessage({
          type: 'init',
          data: {
            width: data.width,
            height: data.height,
            bandCount: data.bandCount,
            activeBand: data.activeBand,
            stats: data.stats,
            geo: data.geo,
            previewWidth: data.previewWidth,
            previewHeight: data.previewHeight,
            previewDataBase64: bytes.toString('base64'),
            sampleDataBase64: sampleBytes.toString('base64'),
          },
        });
      } catch (error) {
        if (controller.signal.aborted || disposed || request !== sequence) return;
        const message = error instanceof Error ? error.message : String(error);
        await panel.webview.postMessage({ type: 'error', message });
      }
    };

    panel.webview.onDidReceiveMessage(async (message: any) => {
      if (message?.type === 'ready') {
        await loadAndSend(activeBand);
      } else if (message?.type === 'changeBand' && Number.isInteger(message.band)) {
        await loadAndSend(message.band);
      } else if (message?.type === 'savePng' && typeof message.dataUrl === 'string') {
        await savePng(message.dataUrl, document.uri);
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
