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

const commandListener =   (e:{ target:any }) => {

    const button = e.target.closest( '.table-command' );

    if( !button ) { // GUARD
        return;
    }

    const { command, index }  =  button.dataset;

    vscode.postMessage({
        command: command,
        text: index,
        });
};   

const updateTableBody = ( table: HTMLTableElement, update?:( tbody: HTMLTableSectionElement  ) => void  ) => {
    const tbody = table.querySelector( 'tbody' ) ;
    if( !tbody ) {
        return null;
    }

    // remove previous listeners
    let commands = tbody.querySelectorAll('.table-command');
    commands.forEach( e => e.removeEventListener( "click", commandListener ));

    if( update ) {
        update( tbody );
    }

    // add listeners
    commands = tbody.querySelectorAll('.table-command');
    commands.forEach( e => e.addEventListener( "click", commandListener ));
};


window.addEventListener("load", () => {

    const submitButton = document.getElementById("submit") as Button|null;
    const undoButton = document.getElementById("undo") as Button|null;
    const submitText = document.getElementById("prompt") as TextArea;
    const historyPrompt = document.getElementById("history_prompt") as HTMLTableElement|null;
    const historyBadge = document.getElementById("history_badge") as Badge|null;
    const panels = document.getElementById("panels");
    const progressRing = document.getElementById("progress-ring");
    const savedPrompt = document.getElementById("saved_prompt") as HTMLTableElement|null;
    const savedBadge = document.getElementById("saved_badge") as Badge|null;
    const submitInfo = document.getElementById("info") as HTMLDivElement;

    if( !(submitButton && 
        submitText && 
        undoButton && 
        historyPrompt && 
        savedPrompt &&
        historyBadge && 
        savedBadge &&
        panels && 
        submitInfo &&
        progressRing ) ) { // GUARD
        return;
    }

    const selectSubmitText = () => {
        (<any>submitText).select();
    };

    window.addEventListener("message", ( event ) => {

        const { command } = event.data;

        switch( command ) {
        case 'history.update':
        {
            undoButton.disabled = false;

            const { data:prompts } = event.data as { data: { tbody: string, length: number} };
            
            updateTableBody( historyPrompt, ( tbody ) => {
                // replace tbody
                tbody.innerHTML = prompts.tbody;
    
                historyBadge.innerText = `${prompts.length}`;
            });

            return;
        }
        case 'saved.update':
        {
            undoButton.disabled = false;

            const { data:prompts } = event.data as { data: { tbody: string, length: number} };
            
            updateTableBody( savedPrompt, ( tbody ) => {
                // replace tbody
                tbody.innerHTML = prompts.tbody;
    
                savedBadge.innerText = `${prompts.length}`;
            });

            return;
        }
        case 'prompt.replace':
        {
            const { data:prompt } = event.data;
            if( validatePrompt( prompt ) ) {
                submitText.value = prompt;
                panels.setAttribute("activeid", "tab-prompt");
            }
            return;
        }
        case 'prompt.submit':
        {
            const { info, progress } = event.data as { info: string, progress: boolean  };

            if( progress ) {
                submitInfo.innerText = '';
                undoButton.disabled = true;
                submitButton.disabled = true;
                progressRing.classList.remove('hide-progress');
                selectSubmitText();
            }
            else {
                submitInfo.innerText = info;
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
            text: submitText.value,
            })
    );

    undoButton.addEventListener("click", () => 
        vscode.postMessage({ command:"prompt.undo" }) );


    const validatePrompt = ( value:string|null ) => {
        const isValid = isStringValid(value);
        submitButton.disabled = !isValid;
        return isValid;
    };        
    
    submitText.addEventListener("input", (e:any) => validatePrompt( e.target.value ));
 
    validatePrompt( submitText.value );

    // Populate grid with data

    updateTableBody( historyPrompt );
    updateTableBody( savedPrompt );

});