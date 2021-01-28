/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Copied from https://github.com/microsoft/vscode/blob/42cdda5ab0f45bf472204d3d1175dcd581492dd5/src/vs/workbench/services/extensions/common/polyfillNestedWorker.protocol.ts

export interface NewWorkerMessage {
    type: '_newWorker';
    id: string;
    port: any /* MessagePort */;
    url: string;
    options: any | /* WorkerOptions */ undefined;
}

export interface TerminateWorkerMessage {
    type: '_terminateWorker';
    id: string;
}
