import { Button, 
    TextArea, 
    provideVSCodeDesignSystem, 
    vsCodeButton, 
    vsCodeTextArea,
    // vsCodeDataGrid, vsCodeDataGridRow, vsCodeDataGridCell,
    vsCodePanels, vsCodePanelView, vsCodePanelTab,
    vsCodeBadge,
    vsCodeProgressRing,
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
    vsCodeBadge(),
    vsCodeProgressRing()
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
    const panels = document.getElementById("panels");
    const progressRing = document.getElementById("progress-ring");

    if( !(submitButton && 
        textArea && 
        undoButton && 
        historyPrompt && 
        historyBadge && 
        panels && 
        progressRing ) ) { // GUARD
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

        const { command } = event.data;

        switch( command ) {
        case 'history.update':
        {
            undoButton.disabled = false;

            const { data:prompts } = event.data as { data: { tbody: string, length: number} };
            
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
        case 'prompt.replace':
        {
            const { data:prompt } = event.data;
            if( validatePrompt( prompt ) ) {
                textArea.value = prompt;
                panels.setAttribute("activeid", "tab-prompt");
            }
            return;
        }
        case 'prompt.submit':
        {
            const { data:progress } = event.data;
            if( progress ) {
                undoButton.disabled = true;
                submitButton.disabled = true;
                progressRing.classList.remove('hide-progress');
            }
            else {
                progressRing.classList.add('hide-progress');
                submitButton.disabled = false;
            }
            return;
        }
            
            
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


    const validatePrompt = ( value:string|null ) => {
        const isValid = isStringValid(value);
        submitButton.disabled = !isValid;
        return isValid;
    };        
    
    textArea.addEventListener("input", (e:any) => validatePrompt( e.target.value ));
 
    validatePrompt( textArea.value );

    // Populate grid with data

});