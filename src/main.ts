import { Button, TextArea, provideVSCodeDesignSystem, vsCodeButton, vsCodeTextArea } from "@vscode/webview-ui-toolkit";


// toolkit registration 
provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeTextArea() );

// dispatch events

const vscode = acquireVsCodeApi();

window.addEventListener("load", () => {
    
    const submitButton = document.getElementById("submit") as Button;
    const textArea = document.getElementById("prompt") as TextArea;

    submitButton?.addEventListener("click", () => {
        vscode.postMessage({
            command: "submit",
            text: textArea.value,
          });
    });
  
});