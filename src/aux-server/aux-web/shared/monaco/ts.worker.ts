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
import { CustomTypeScriptWorker, onStateUpdated } from './tsWorker';

self.onmessage = (m) => {
    if (typeof m.data === 'object' && m.data.__type === 'state') {
        onStateUpdated(m.data.simId, m.data.update);
        return;
    }

    // ignore the first message
    initialize((ctx: worker.IWorkerContext, createData: any) => {
        return new CustomTypeScriptWorker(ctx, createData);
    });
};

// export { TypeScriptWorker, create, initialize, libFileMap, ts };
