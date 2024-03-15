/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    initialize,
    ts,
    TypeScriptWorker,
} from '@casual-simulation/monaco-editor/esm/vs/language/typescript/ts.worker';
import type { worker } from '@casual-simulation/monaco-editor';
import { CustomTypeScriptWorker } from './tsWorker';
// import * as ts from './lib/typescriptServices';
// import { ICreateData, ITypeScriptWorkerHost, TypeScriptWorker, create } from './tsWorker';
// import { worker } from '../../fillers/monaco-editor-core';
// import { libFileMap } from './lib/lib';

self.onmessage = () => {
    // ignore the first message
    initialize((ctx: worker.IWorkerContext, createData: any) => {
        return new CustomTypeScriptWorker(ctx, createData);
    });
};

// export { TypeScriptWorker, create, initialize, libFileMap, ts };
