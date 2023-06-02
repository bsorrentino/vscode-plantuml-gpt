// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "plantuml-gpt" is now active!');


	context.subscriptions.push(_registerCommandOpenPanel());

	
	context.subscriptions.push(_registerPlantUMLViewProvider(context));
		

	// const langs = await vscode.languages.getLanguages();
	context.subscriptions.push(_detectEditorLanguage(context));
	
	const config = vscode.workspace.getConfiguration();

	console.log( 'configuration' , config.inspect('plantuml-gpt')  );

	
}

// This method is called when your extension is deactivated
export function deactivate() {}

const _registerCommandOpenPanel = () => 
	vscode.commands.registerCommand('plantuml-gpt.open', () => 
		vscode.commands.executeCommand('setContext', 'plantuml-gpt.active', true )
);


const _getCurrentEditorLanguage = ( editor?: vscode.TextEditor ) => {
	
	if (editor) {
		// Get the document associated with the active text editor
		const document = editor.document;
		
		// Get the language ID of the document
		return document.languageId;
		
	}
	else {
		return null;
	}

};

const _detectEditorLanguage = (context: vscode.ExtensionContext) => 
    vscode.window.onDidChangeActiveTextEditor( editor  => {

		const languageId = _getCurrentEditorLanguage( editor );
	
		if (languageId ) {      
			vscode.commands.executeCommand('setContext', 'plantuml-gpt.active', languageId === 'plantuml');

			vscode.window.showInformationMessage(`The current editor language is ${languageId}.`);
		}	
		else {
			vscode.window.showWarningMessage('No active text editor found.');
		}
    });

/**
 * register view provider
 */
const _registerPlantUMLViewProvider = (context: vscode.ExtensionContext) => {
	const provider = new PlantUMLGPTProvider(context.extensionUri);

	return vscode.window.registerWebviewViewProvider(PlantUMLGPTProvider.viewId, provider);
};

/**
 * resolve uri
 */
const _getUri = (webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) =>
  webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));

const _getNonce = () => {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
	  text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
  }

/**
 * [webview-view-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/webview-view-sample)
 */
class PlantUMLGPTProvider implements vscode.WebviewViewProvider {
	public static readonly viewId = 'plantuml-gpt.view';

	private _view?: vscode.WebviewView;

	constructor( private readonly _extensionUri: vscode.Uri ) { 
		console.log( 'PlantUMLGPTProvider', _extensionUri);
	}

	public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken): void | Thenable<void> {
		console.log( 'PlantUMLGPTProvider', 'resolveWebviewView');
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getWebviewContent(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'colorSelected':
					{
						vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
						break;
					}
			}
		});
	}
  
	private _getWebviewContent( webview: vscode.Webview ) {

		const webViewUri = _getUri( webview, this._extensionUri, ['dist', 'webview.js']);
		
		const nonce = _getNonce();

		console.log(webViewUri, nonce );
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}';">
			<title>PlantUML + GPT</title>
			
		</head>
	  <body>
	  <vscode-text-area cols="80" rows="10">edit me</vscode-text-area>
	  <br>
	  <vscode-button>Click me</vscode-button>
	  <script type="module" nonce="${nonce}" src="${webViewUri}"></script>
	  </body>
	  </html>`;
	  }
	
}