import { Button, 
    TextArea, 
    provideVSCodeDesignSystem, 
    vsCodeButton, 
    vsCodeTextArea,
    // vsCodeDataGrid, vsCodeDataGridRow, vsCodeDataGridCell,
    vsCodePanels, vsCodePanelView, vsCodePanelTab,
    vsCodeBadge,
    Badge,
    // DataGrid
} from "@vscode/webview-ui-toolkit";


// toolkit registration 
provideVSCodeDesignSystem().register(
    vsCodeButton(), 
    vsCodeTextArea(), 
    // vsCodeDataGrid(), 
    // vsCodeDataGridRow(), 
    // vsCodeDataGridCell(),
    vsCodePanels(), 
    vsCodePanelView(),
    vsCodePanelTab(),
    vsCodeBadge()
    );

// dispatch events

const vscode = acquireVsCodeApi();

const isStringValid = ( value: string|null ):boolean => value!==null && value.length>0;


window.addEventListener("load", () => {

    const submitButton = document.getElementById("submit") as Button|null;
    const undoButton = document.getElementById("undo") as Button|null;
    const textArea = document.getElementById("prompt") as TextArea;
    const historyPrompt = document.getElementById("history_prompt") as HTMLTableElement|null;
    const historyBadge = document.getElementById("history_badge") as Badge|null;

    if( !(submitButton && textArea && undoButton && historyPrompt && historyBadge ) ) { // GUARD
        return;
    }

    let commands:NodeListOf<Element>|null = null;

    const commandListener =   (e:{ target:any }) => {

        const button = e.target.closest( '.history-command' );

        if( !button ) { // GUARD
            return;
        }

        const { command, index }  =  button.dataset;

        vscode.postMessage({
            command: command,
            text: index,
            });
    };   


    window.addEventListener("message", ( event ) => {

        const { command, data:prompts } = event.data as  { command:string, data: { tbody: string, length: number} };

        switch( command ) {
        case 'history.update':
            const tbody = historyPrompt.querySelector( 'tbody' ) ;
            if( tbody ) {
                
                // Unregister listener
                if( commands ) {
                    commands.forEach( e => e.removeEventListener( "click", commandListener ));
                }
                
                // replace tbody
                tbody.innerHTML = prompts.tbody;
    
                historyBadge.innerText = `${prompts.length}`;
                
                commands = tbody.querySelectorAll('.history-command');

                // Register listeners
                if( commands ) {
                    commands.forEach( e => e.addEventListener( "click", commandListener ));
                }
            }
            return;
        }
        
    });

    submitButton.addEventListener("click", () => 
        vscode.postMessage({
            command: "prompt.submit",
            text: textArea.value,
            })
    );

    undoButton.addEventListener("click", () => 
        vscode.postMessage({ command:"prompt.undo" }) );


    const validatePrompt = ( value:string|null ) =>        
        submitButton.disabled = !isStringValid(value) ;
    
    textArea.addEventListener("input", (e:any) => validatePrompt( e.target.value ));
 
    validatePrompt( textArea.value );

    // Populate grid with data

});