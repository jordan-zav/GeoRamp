import * as vscode from 'vscode';
import { loadGeoTiffBand } from './geoTiffLoader';
import { getWebviewContent } from './webviewContent';

class GeoTiffDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}
  dispose(): void {}
}

export class GeoRampEditorProvider implements vscode.CustomReadonlyEditorProvider<GeoTiffDocument> {
  public static readonly viewType = 'georamp.viewer';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new GeoRampEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      GeoRampEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  public async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<GeoTiffDocument> {
    return new GeoTiffDocument(uri);
  }

  public async resolveCustomEditor(
    document: GeoTiffDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
      ],
    };

    const fileName = document.uri.fsPath.split(/[/\\]/).pop() || 'Raster';
    webviewPanel.webview.html = getWebviewContent(
      webviewPanel.webview,
      this.context.extensionUri,
      fileName
    );

    let activeBand = 0;
    const loadAndSend = async (band: number) => {
      try {
        const data = await loadGeoTiffBand(document.uri.fsPath, band);
        activeBand = data.activeBand;

        const previewArray = new Array(data.previewData.length);
        for (let i = 0; i < data.previewData.length; i++) {
          const v = data.previewData[i];
          previewArray[i] = Number.isNaN(v) ? null : v;
        }

        webviewPanel.webview.postMessage({
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
            previewData: previewArray,
          },
        });
      } catch (err: any) {
        vscode.window.showErrorMessage(`Error al cargar el archivo GeoTIFF: ${err.message}`);
      }
    };

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'ready') {
        await loadAndSend(activeBand);
      } else if (message.type === 'changeBand') {
        await loadAndSend(message.band);
      }
    });
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(GeoRampEditorProvider.register(context));

  context.subscriptions.push(
    vscode.commands.registerCommand('georamp.openPreview', (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (targetUri) {
        vscode.commands.executeCommand('vscode.openWith', targetUri, GeoRampEditorProvider.viewType);
      } else {
        vscode.window.showInformationMessage('Por favor selecciona un archivo GeoTIFF (*.tif, *.tiff).');
      }
    })
  );
}

export function deactivate() {}
