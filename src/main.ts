import { Button, 
    TextArea, 
    provideVSCodeDesignSystem, 
    vsCodeButton, 
    vsCodeTextArea,
    vsCodeDataGrid, vsCodeDataGridRow, vsCodeDataGridCell,
    vsCodePanels, vsCodePanelView, vsCodePanelTab,
    vsCodeBadge
} from "@vscode/webview-ui-toolkit";


// toolkit registration 
provideVSCodeDesignSystem().register(
    vsCodeButton(), 
    vsCodeTextArea(), 
    vsCodeDataGrid(), 
    vsCodeDataGridRow(), 
    vsCodeDataGridCell(),
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

    if( !(submitButton && textArea && undoButton ) ) { // GUARD
        return;
    }

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
});