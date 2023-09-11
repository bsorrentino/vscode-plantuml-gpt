// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { OpenAI, ClientOptions } from 'openai';
import * as https from 'node:https';

// [How to use the VSCode local storage API](https://www.chrishasz.com/blog/2020/07/28/vscode-how-to-use-local-storage-api/)
class LocalStorageService {

	constructor(private storage: vscode.Memento) { 

		if( 'setKeysForSync' in storage ) {

			const global = storage as  { setKeysForSync(keys: readonly string[]): void; };

			global.setKeysForSync( [ 'prompts' ] );
		}
	}   

	public getPrompts(): Array<string> {
		return this._getValue<Array<string>>( 'prompts' ) ?? [];
	}

	public addPrompt( prompt: string ) {

		const prompts = this.getPrompts();

		prompts.push( prompt );

		this._setValue( 'prompts', prompts );
	}

	public removePromptAtIndex( index: number ): string[]|null {
		const prompts = this.getPrompts();
		if( index < 0 || index >= prompts.length ) {
			return null;
		}
		const removedElements = prompts.splice(index, 1);
		
		this._setValue( 'prompts', prompts );

		return removedElements;
	}

	private _getValue<T>(key : string) : T | null {
		return this.storage.get<T | null>(key, null);
	}
	private _setValue<T>(key : string, value : T ){
		this.storage.update(key, value );
	}
}


class PromptsSaved {

	private _promptSaved:Array<string>;

	constructor( private storage: LocalStorageService ) {
		this._promptSaved = storage.getPrompts();
	}

	get content() {

		return this._promptSaved.map( (p,i) => 
			`<tr>
			<td>${p}</td>
			<td class="nowrap">
			<vscode-button class="table-command" data-command="saved.replace" data-index="${i}" appearance="icon" aria-label="Replace">
				<span class="codicon codicon-reply"></span>
			</vscode-button>
			<vscode-button class="table-command"  data-command="saved.delete" data-index="${i}" appearance="icon" aria-label="Delete">
				<span class="codicon codicon-trash"></span>
			</vscode-button>
			</td>
			</tr>`).join('\n');

	}

	get length() { return  this._promptSaved.length; } 

	getPrompt( index: number ) {
		return ( index >= 0 && index < this._promptSaved.length) ? this._promptSaved[index] : null;
	} 

	addPrompt( prompt: string ) {
		this._promptSaved.push( prompt );
		this.storage.addPrompt( prompt );
	}

	removePrompt( index: number ) {
		if( index >= 0 && index < this._promptSaved.length) {
			this._promptSaved.splice(index, 1);	
			this.storage.removePromptAtIndex( index );
			return true;
		}
		return false;
	}
}

class PromptsHistory {

	private _promptHistory:Array<string> ;

	constructor(  ) { 
		this._promptHistory = [];
		// _promptHistory.concat(  Array<string>(10).fill("Prompt ahgsdgasdfasdfahgfdagsdfahgsdfahgfsdagfghfadsfahdgf") );
	}

	get content() {

		return this._promptHistory.map( (p,i) => 
			`<tr>
			<td>${p}</td>
			<td class="nowrap">
			<vscode-button class="table-command" data-command="history.replace" data-index="${i}" appearance="icon" aria-label="Replace">
				<span class="codicon codicon-reply"></span>
			</vscode-button>
			<vscode-button class="table-command"  data-command="history.delete" data-index="${i}" appearance="icon" aria-label="Delete">
				<span class="codicon codicon-trash"></span>
			</vscode-button>
			<vscode-button class="table-command"  data-command="history.save" data-index="${i}" appearance="icon" aria-label="Save">
				<span class="codicon codicon-save"></span>
			</vscode-button>
			</td>
			</tr>`).join('\n');

	}

	get length() { return  this._promptHistory.length; } 

	getPrompt( index: number ) {
		return ( index >= 0 && index < this._promptHistory.length) ? this._promptHistory[index] : null;
	} 

	addPrompt( prompt: string ) {
		this._promptHistory.push( prompt );
	}

	removePrompt( index: number ) {
		if( index >= 0 && index < this._promptHistory.length) {
			this._promptHistory.splice(index, 1);	
			return true;
		}
		return false;
	}

}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// console.log( "storageUri", context.workspaceState , "globalStorageUri", context.globalState );


	const { activeTextEditor } = vscode.window;

	if( activeTextEditor ) {

		const languageId = activeTextEditor.document?.languageId;

		_setActive( languageId==='plantuml' ).then( active => {
			if( active ) {
				vscode.commands.executeCommand("plantuml-gpt.view.focus");
			}
		});

		// Use the console to output diagnostic information (console.log) and errors (console.error)
		// This line of code will only be executed once when your extension is activated
		console.log(`Congratulations, your extension "plantuml-gpt" is now active! - languageId: ${languageId}`);

	}


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

	const storage = new LocalStorageService( context.globalState );

	const provider = new PlantUMLGPTProvider(context.extensionUri, storage);

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
	private _promptHistory = new PromptsHistory();
	private _promptSaved:PromptsSaved;

	constructor( private readonly _extensionUri: vscode.Uri, storage: LocalStorageService ) { 
		// console.log( 'PlantUMLGPTProvider', _extensionUri);	

		this._promptSaved = new PromptsSaved(storage);
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

			const { command, text } = data;

			switch (command) {
				// case 'colorSelected':
				// 	vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
				// 	return;
				case 'prompt.submit':
				{
					let info:string|null = null;

					this._sendMessageToWebView( 'prompt.submit', { info: info, progress: true } );
					this._submitAndReplace( text )
					.then( result => {			
						info = result.info;
						this._undoText = result.input;
						this._promptHistory.addPrompt( text );
						this._sendMessageToWebView( 'history.update', {
							tbody: this._promptHistory.content,
							length: this._promptHistory.length
						});
					})
					.catch( e => { 
						// console.log( 'SUBMIT ERROR', e );
						info = `ERROR: ${e.description ?? ''}`;
					}).finally( () => 
						this._sendMessageToWebView( 'prompt.submit', { info: info, progress: false } )
					);
					return;
				}
				case 'prompt.undo':

					this._undo();
					
					return;
				case 'saved.replace':
				{	
					const index = parseInt(text);
					const prompt = this._promptSaved.getPrompt(index);
					if( prompt ) {
						this._sendMessageToWebView( 'prompt.replace', prompt);
					}
					return;
				}		
				case 'history.replace':
				{	
					const index = parseInt(text);
					const prompt = this._promptHistory.getPrompt(index);
					if( prompt ) {
						this._sendMessageToWebView( 'prompt.replace', prompt);
					}
					return;
				}
				case 'history.delete':
				{
					const index = parseInt(text);
					if( this._promptHistory.removePrompt( index ) ) {
						this._sendMessageToWebView( 'history.update', {
							tbody: this._promptHistory.content,
							length: this._promptHistory.length
						});
					}
					return;
				}
				case 'saved.delete':
				{
					const index = parseInt(text);
					if( this._promptSaved.removePrompt( index ) ) {
						this._sendMessageToWebView( 'saved.update', {
							tbody: this._promptSaved.content,
							length: this._promptSaved.length
						});
					}
					return;
				}
				case 'history.save':
				{
					const index = parseInt(text);
					const prompt = this._promptHistory.getPrompt(index);
					if( prompt ) {
						this._promptSaved.addPrompt( prompt );
						this._sendMessageToWebView( 'saved.update', {
							tbody: this._promptSaved.content,
							length: this._promptSaved.length
						});
					}
					return;
				}
			}


		}, undefined, this._disposables);

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
 <vscode-panels id="panels" aria-label="Default">
  <vscode-panel-tab id="tab-prompt">Prompt</vscode-panel-tab>
  <vscode-panel-tab id="tab-history">History<vscode-badge id="history_badge">${this._promptHistory.length}</vscode-badge></vscode-panel-tab>
  <vscode-panel-tab id="tab-saved">Saved<vscode-badge id="saved_badge">${this._promptSaved.length}</vscode-badge></vscode-panel-tab>
  <vscode-panel-view id="wiew-1">
   <div id="prompt_container">
    <vscode-text-area id="prompt" rows="10" cols="80" resize="horizontal" ${submitDisabledTag('readonly')} placeholder="${ submitDisabled ? 'Please provides API KEY in extension settings' : 'Let chat with PlantUML diagram'}"></vscode-text-area>
	<div id="bottom-bar">
	    <div id="info"></div>
		<div id="command-bar">
			<vscode-button id="undo" ${undoDisabledTag('disabled')}>Undo</vscode-button>
			<vscode-button id="submit" ${submitDisabledTag('disabled')}>Submit</vscode-button>
			<vscode-progress-ring id="progress-ring" class="hide-progress"></vscode-progress-ring>
		</div>
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
				${this._promptHistory.content}
			</tbody>
		</table>
	</div>
  </vscode-panel-view>
  <vscode-panel-view id="view-2">
  <div class="table-scroll">
	  <table id="saved_prompt">
		  <thead>
			  <tr>
				  <th>Prompt</th>
				  <th>Actions</th>
			  </tr>
		  </thead>
		  <tbody>
			  ${this._promptSaved.content}
		  </tbody>
	  </table>
  </div>
</vscode-panel-view>

 </vscode-panels>
 <script type="module" nonce="${nonce}" src="${webViewJSUri}"></script>

</body>
</html>`;
	}
	
	private async _submitAndReplace( instruction: string ):Promise<{input:string|null, result?:string|null, info: string}> {

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

		const input = _getAllTextFromEditor( activeTextEditor) ?? '';

		if( !( instruction && instruction.length > 0) ) {
			// eslint-disable-next-line no-throw-literal
			throw 'instruction is empty!';
		}

		const configuration:ClientOptions = {
		  apiKey: apikey,
		};
		const openai = new OpenAI(configuration);
		
		try {
			

			// const response = await openaiRawRequest( apikey,{
			// 	model: "text-davinci-edit-001",
			// 	input: input.replace(/(?:\r\n|\r|\n)+/g, '\n'),
			// 	instruction: instruction,
			// 	temperature: 0,
			// 	// eslint-disable-next-line @typescript-eslint/naming-convention
			// 	top_p: 1,
			// });
			// const result = response.choices[0].text;

			const response = await openai.chat.completions.create({
				model: "gpt-3.5-turbo",
				messages: [
					{
						role: "system",
						content: `You are my plantUML assistant
						Please respond exclusively with diagram code`
					},
					{
						role: "assistant",
						content: input.replace(/(?:\r\n|\r|\n)+/g, '\n')
					},
					{
						role: 'user',
						content: instruction
					}					
				],
				temperature: 0.5,
				// eslint-disable-next-line @typescript-eslint/naming-convention
				top_p: 1,
			});

			const { choices, usage } = response;

			const result = choices[0].message.content;
			const info = `Tokens | prompt: ${usage?.prompt_tokens} | completion: ${usage?.completion_tokens} | total: ${usage?.total_tokens} |`;
			console.log( result );
			if( result ) {
				_replaceTextInEditor( activeTextEditor, result );
			}


			return { input, result, info };
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


interface OpenAIResult {
	object: string,
	created: number,
	choices: Array<{ text: string, index: number }>,
	usage: {
		  // eslint-disable-next-line @typescript-eslint/naming-convention
		  prompt_tokens: number,
		  // eslint-disable-next-line @typescript-eslint/naming-convention
		  completion_tokens: number,
		  // eslint-disable-next-line @typescript-eslint/naming-convention
		  total_tokens: number
		}
}

function openaiRawRequest( 
	apiKey: string,
	postData: {
		model: string,
		input: string|null,
		instruction: string,
		temperature: number,
		// eslint-disable-next-line @typescript-eslint/naming-convention
		top_p: number,
}): Promise<OpenAIResult>
{

	const body = JSON.stringify(postData);
	const options = {
		hostname: "api.openai.com",
		port: 443,
		path: "/v1/edits",
		method: 'POST',
		headers: {
		  // eslint-disable-next-line @typescript-eslint/naming-convention
		  'Content-Type': 'application/json',
		  // eslint-disable-next-line @typescript-eslint/naming-convention
		  // 'Content-Length': Buffer.byteLength(body),
		  // eslint-disable-next-line @typescript-eslint/naming-convention
		  'Authorization': `Bearer ${apiKey}`
		}
	  };
	
	  return new Promise<OpenAIResult>( (resolve, reject) => {
		//change to http for local testing
		const req = https.request(options, res => {

			res.setEncoding('utf8');
		
			let result = '';
		
			res.on('data', chunk => result = result + chunk );
		
			res.on('end',() => {
			
				if (res.statusCode !== 200) {
					reject( res );
				} else {
					resolve( JSON.parse(result) );
				}
			});
		
		});
		
		req.on('error', e =>  reject(e) );
		
		// write data to request body
		req.write(body);
		req.end();

	  });
	
	
}
