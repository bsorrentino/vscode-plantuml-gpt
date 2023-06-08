// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Configuration, OpenAIApi } from 'openai';


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
	vscode.commands.executeCommand('setContext', 'plantuml-gpt.active', value ).then( () => value );


const _registerCommandOpenPanel = () => 
	vscode.commands.registerCommand('plantuml-gpt.open', async () => {
	
		const { apikey } = vscode.workspace.getConfiguration('plantuml-gpt');

		if( apikey ) {
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

		if (languageId ) {      
			console.log( `The current editor language is ${languageId}.` );
			// vscode.window.showInformationMessage(`The current editor language is ${languageId}.`);
		}	
		else {
			console.log( 'No active text editor found.' );
			// vscode.window.showWarningMessage('No active text editor found.');
		}

		_setActive( languageId === 'plantuml' ).then( active => {
			if( active ) {
				vscode.commands.executeCommand("plantuml-gpt.view.focus");
			}
		});

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
 * @return  {string}  nonce value
 */
const _getNonce = (): string => {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
	  text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
  };


const _getAllTextRangeFormEditor = ( editor: vscode.TextEditor ) => {
	const { document:doc }  = editor;

	const firstLine = doc.lineAt(0);
	const  lastLine = doc.lineAt(doc.lineCount - 1);
	return new vscode.Range(firstLine.range.start, lastLine.range.end);

};


const _replaceTextInEditor = ( editor: vscode.TextEditor, text: string ) => {

	const range = _getAllTextRangeFormEditor(editor);

	if( range ) {
		editor.edit( builder => builder.replace( range, text ) );
	}
};

const _getAllTextFromEditor = ( editor: vscode.TextEditor) => {

	const range = _getAllTextRangeFormEditor( editor );

	if( range ) {
		return editor?.document.getText( range );	
	}

	return null;

};


/**
 * [webview-view-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/webview-view-sample)
 */
class PlantUMLGPTProvider implements vscode.WebviewViewProvider {
	public static readonly viewId = 'plantuml-gpt.view';

	private _view: vscode.WebviewView|null = null;
	private _disposables: vscode.Disposable[] = [];
	private _undoText:string|null = null;
	// private _promptHistory =  Array<string>(10).fill("Prompt ahgsdgasdfasdfahgfdagsdfahgsdfahgfsdagfghfadsfahdgf");
	private _promptHistory = Array<string>();

	constructor( private readonly _extensionUri: vscode.Uri ) { 
		// console.log( 'PlantUMLGPTProvider', _extensionUri);	
	}

	public resolveWebviewView(	webviewView: vscode.WebviewView, 
								context: vscode.WebviewViewResolveContext<unknown>, 
								token: vscode.CancellationToken): void | Thenable<void> 
	{
		console.log( 'PlantUMLGPTProvider', 'resolveWebviewView');

		this._view = webviewView;

		this._view.onDidDispose(() => {
			console.log( 'view.dispose()');
			this._view = null;
		}, null, this._disposables);

		const { webview } = webviewView;
		
		webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				// this._extensionUri,
				vscode.Uri.joinPath(this._extensionUri, 'media'),
				vscode.Uri.joinPath(this._extensionUri, 'dist'),
				vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist'),
			],
		};

		webview.html = this._getWebviewContent(webviewView.webview);

		this._disposables.push( this._addMessageHandler(webview) );

		this._sendMessageToWebView( 'history.update', {
			tbody: this._getHistoryBodyContent(),
			length: this._promptHistory.length
		});

	}

	private _undo() {

		const { activeTextEditor } = vscode.window;
		if( activeTextEditor && this._undoText) {
			_replaceTextInEditor( activeTextEditor, this._undoText );
			this._undoText = null;

		}

	}
  
	private _sendMessageToWebView<T>( command: string, data:T ) {
		this._view?.webview.postMessage( { command: command, data: data} );
	}

	private _addMessageHandler( webview: vscode.Webview  ) {
		return webview.onDidReceiveMessage(data => {

			console.log( 'onDidReceiveMessage', data);

			const { command, text:prompt } = data;

			switch (command) {
				// case 'colorSelected':
				// 	vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
				// 	return;
				case 'prompt.submit':
					this._submitAndReplace( prompt )
					.then( result => {			
						this._undoText = result.input;
						this._promptHistory.push( prompt );
						this._sendMessageToWebView( 'history.update', {
							tbody: this._getHistoryBodyContent(),
							length: this._promptHistory.length
						});
					})
					.catch( e => {
						console.log( 'SUBMIT ERROR', e );
					});
					return;
				case 'prompt.undo':

					this._undo();
					return;
				case 'history.replay':
					return;
				case 'history.delete':
					return;
				case 'history.save':
					return;
			}


		}, undefined, this._disposables);

	}

	private _getHistoryBodyContent() {

		return this._promptHistory.map( (p,i) => 
			`<tr>
			<td>${p}</td>
			<td>
			<vscode-button class="history-command" data-command="history.replay" data-index="${i}" appearance="icon" aria-label="Reply">
				<span class="codicon codicon-reply"></span>
			</vscode-button>
			<vscode-button class="history-command"  data-command="history.delete" data-index="${i}" appearance="icon" aria-label="Trash">
				<span class="codicon codicon-trash"></span>
			</vscode-button>
			<vscode-button class="history-command"  data-command="history.save" data-index="${i}" appearance="icon" aria-label="Save">
				<span class="codicon codicon-save"></span>
			</vscode-button>
			</td>
			</tr>`).join('\n');

	}

	private _getWebviewContent( webview: vscode.Webview ) {

		const webViewJSUri = _getUri( webview, this._extensionUri, ['dist', 'webview.js']);
		const cssUri = _getUri( webview, this._extensionUri, ['media', 'styles.css']);
		const codiconsUri = _getUri(webview, this._extensionUri, ['node_modules', '@vscode/codicons', 'dist', 'codicon.css']);

		const nonce = _getNonce();

		const { apikey } = vscode.workspace.getConfiguration('plantuml-gpt');

		const submitDisabled = !apikey;
		const undoDisabled = !this._undoText;

		const submitDisabledTag = ( tag:string ) => submitDisabled ? tag : '';
		const undoDisabledTag = ( tag:string ) => undoDisabled ? tag : '';

		// console.log(webViewJSUri, cssUri, nonce );
		// console.log(  webview.cspSource );

		return `
<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; font-src  ${webview.cspSource} ; style-src ${webview.cspSource} 'nonce-${nonce}';">
 <title>PlantUML + GPT</title>
 <link href="${cssUri}" rel="stylesheet" />
 <link href="${codiconsUri}" rel="stylesheet" />
</head>
<body>
 <vscode-panels aria-label="Default">
  <vscode-panel-tab id="tab-1">Prompt</vscode-panel-tab>
  <vscode-panel-tab id="tab-2">History<vscode-badge id="history_badge">${this._promptHistory.length}</vscode-badge></vscode-panel-tab>
  <vscode-panel-view id="wiew-1">
   <div id="prompt_container">
    <vscode-text-area id="prompt" cols="80" rows="10" ${submitDisabledTag('readonly')} placeholder="${ submitDisabled ? 'Please provides API KEY in extension settings' : 'Let chat with PlantUML diagram'}"></vscode-text-area>
    <div id="command">
		<vscode-button id="undo" ${undoDisabledTag('disabled')}>Undo</vscode-button>
		<vscode-button id="submit" ${submitDisabledTag('disabled')}>Submit</vscode-button>
	</div>
   </div>
  </vscode-panel-view>
  <vscode-panel-view id="view-2">
	<div class="table-scroll">
		<table id="history_prompt">
			<thead>
				<tr>
					<th>Prompt</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
			</tbody>
		</table>
	</div>
  </vscode-panel-view>
 </vscode-panels>
 <script type="module" nonce="${nonce}" src="${webViewJSUri}"></script>

</body>
</html>`;
	}
	
	private async _submitAndReplace( instruction: string ):Promise<{input:string|null, result?:string|null}> {

		const { apikey } = vscode.workspace.getConfiguration('plantuml-gpt');

		if( !(apikey && apikey.length>0) ) { // GUARD
			// eslint-disable-next-line no-throw-literal
			throw 'apikey is not set!';
		}

		const { activeTextEditor } = vscode.window;

		if( !activeTextEditor ) {
			// eslint-disable-next-line no-throw-literal
			throw 'no active editor!';
		}

		const input = _getAllTextFromEditor( activeTextEditor);

		if( !( instruction && instruction.length>0) ) {
			// eslint-disable-next-line no-throw-literal
			throw 'instruction is empty!';
		}

		const configuration = new Configuration({
		  apiKey: apikey,
		});
		const openai = new OpenAIApi(configuration);
		
		try {
			const response = await openai.createEdit({
				model: "text-davinci-edit-001",
				input: input,
				instruction: instruction,
				temperature: 0,
				['top_p']: 1,
			});

			const result = response.data.choices[0].text;

			if( result ) {
				_replaceTextInEditor( activeTextEditor, result );
			}

			return { input, result };
		}
		catch( error:any ) {
			if( error.response ) {
				throw error.response;
			}
			else {
				throw error;
			}
		}

	}
}