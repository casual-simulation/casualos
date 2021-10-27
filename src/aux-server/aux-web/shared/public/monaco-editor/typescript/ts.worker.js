/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as edworker from 'monaco-editor/esm/vs/editor/editor.worker.js';
import { TypeScriptWorker } from './tsWorker';

// Note: This file needs to be valid JavaScript.
// worker-loader for some reason does not run ts-loader during its child compilation.

self.onmessage = () => {
    // ignore the first message
    edworker.initialize((ctx, createData) => {
        return new TypeScriptWorker(ctx, createData);
    });
};
