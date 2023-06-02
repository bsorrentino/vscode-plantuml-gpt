// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	const languageId = vscode.window.activeTextEditor?.document?.languageId;

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(`Congratulations, your extension "plantuml-gpt" is now active! - languageId: ${languageId}`);

	_setActive( languageId==='plantuml' );

	// context.subscriptions.push(_registerCommandOpenPanel());

	context.subscriptions.push(_registerPlantUMLViewProvider(context));
		
	// const langs = await vscode.languages.getLanguages();
	context.subscriptions.push(_detectEditorLanguage(context));
	
}

// This method is called when your extension is deactivated
export function deactivate() {}

const _setActive = ( value:boolean ) => 
	vscode.commands.executeCommand('setContext', 'plantuml-gpt.active', value );


const _registerCommandOpenPanel = () => 
	vscode.commands.registerCommand('plantuml-gpt.open', async () => {
	
		const { apikey } = vscode.workspace.getConfiguration('plantuml-gpt');

		if( apikey && apikey.length>0 ) {
			return _setActive( true );
		}

		return vscode.window.showWarningMessage('No OpenAPI Api Key set!');
		
	
	}
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

		_setActive( languageId === 'plantuml');
	
		if (languageId ) {      
			console.log( `The current editor language is ${languageId}.` );
			// vscode.window.showInformationMessage(`The current editor language is ${languageId}.`);
		}	
		else {
			console.log( 'No active text editor found.' );
			// vscode.window.showWarningMessage('No active text editor found.');
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

/**
 * You should also update the content security policy of your webview to only allow scripts that have a specific nonce
 * 
 * @link https://github.com/microsoft/vscode-webview-ui-toolkit/blob/main/docs/getting-started.md#enable-webview-scripts-and-improve-security
 * @return  {[string]}  nonce value
 */
const _getNonce = () => {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
	  text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
  };

/**
 * [webview-view-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/webview-view-sample)
 */
class PlantUMLGPTProvider implements vscode.WebviewViewProvider {
	public static readonly viewId = 'plantuml-gpt.view';

	private _view?: vscode.WebviewView;
	private _disposables: vscode.Disposable[] = [];

	constructor( private readonly _extensionUri: vscode.Uri ) { 
		console.log( 'PlantUMLGPTProvider', _extensionUri);
	}

	public resolveWebviewView(	webviewView: vscode.WebviewView, 
								context: vscode.WebviewViewResolveContext<unknown>, 
								token: vscode.CancellationToken): void | Thenable<void> 
	{
		// console.log( 'PlantUMLGPTProvider', 'resolveWebviewView');

		this._view = webviewView;

		this._view.onDidDispose(() => {
			console.log( 'dispose()');
		}, null, this._disposables);

		const { webview } = webviewView;
		
		webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webview.html = this._getWebviewContent(webviewView.webview);

		this._disposables.push( this._addMessageHandler(webview) );

	}
  
	private _addMessageHandler( webview: vscode.Webview  ) {
		return webview.onDidReceiveMessage(data => {
			console.log( 'onDidReceiveMessage', data);

			const { command, text } = data;

			switch (command) {
				case 'colorSelected':
					vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
					return;
				case 'submit':
					console.log( 'submit' );
					return;
			}

		}, undefined, this._disposables);

	}

	private _getWebviewContent( webview: vscode.Webview ) {

		const webViewUri = _getUri( webview, this._extensionUri, ['dist', 'webview.js']);
		
		const nonce = _getNonce();

		const { apikey } = vscode.workspace.getConfiguration('plantuml-gpt');

		const disabled = !(apikey && apikey.length>0);
		
		const disabledTag = ( tag:string ) => 
			disabled ? tag : '';
		

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
	  <vscode-text-area id="prompt" cols="80" rows="10" ${disabledTag('readonly')} placeholder="${ disabled ? 'Please provides API KEY in extension settings' : 'Let chat with PlantUML diagram'}">Prompt:</vscode-text-area>
	  <br>
	  <vscode-button id="submit" ${disabledTag('disabled')}>Submit</vscode-button>
	  <script type="module" nonce="${nonce}" src="${webViewUri}"></script>
	  </body>
	  </html>`;
	  }
	
}