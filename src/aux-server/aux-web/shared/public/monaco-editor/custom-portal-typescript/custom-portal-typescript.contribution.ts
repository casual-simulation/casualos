/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { registerLanguage } from 'monaco-editor/esm/vs/basic-languages/_.contribution.js';

export const customPortalLanguageId = 'custom-portal-javascript';

registerLanguage({
    id: customPortalLanguageId,
    extensions: ['.js', '.es6', '.jsx', '.mjs'],
    firstLine: '^#!.*\\bnode',
    filenames: ['jakefile'],
    aliases: ['CustomPortalJavascript', 'customPortalJavascript', 'cpjs'],
    mimetypes: ['text/javascript'],
    loader: function () {
        return import('./custom-portal-typescript');
    },
});
