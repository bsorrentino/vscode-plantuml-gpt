import { provideVSCodeDesignSystem, vsCodeButton, vsCodeTextArea } from "@vscode/webview-ui-toolkit";


console.log( 'main.js loading!');

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeTextArea() );

console.log( 'main.js loaded!');