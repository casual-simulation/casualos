/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { WorkerManager } from './workerManager';
import type { TypeScriptWorker } from 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import { LanguageServiceDefaults } from './languageService';
import * as languageFeatures from 'monaco-editor/esm/vs/language/typescript/languageFeatures';
import { languages, Uri } from './fillers/monaco-editor-core';

let workers = new Map<string, (...uris: Uri[]) => Promise<TypeScriptWorker>>();

export function setupLangaugeMode(
    modeId: string,
    defaults: LanguageServiceDefaults
): void {
    workers.set(modeId, setupMode(defaults, modeId));
}

export function setupTypeScript(defaults: LanguageServiceDefaults): void {
    setupLangaugeMode('typescript', defaults);
}

export function setupJavaScript(defaults: LanguageServiceDefaults): void {
    setupLangaugeMode('javascript', defaults);
}

export function getJavaScriptWorker(): Promise<
    (...uris: Uri[]) => Promise<TypeScriptWorker>
> {
    return getWorker('javascript');
}

export function getTypeScriptWorker(): Promise<
    (...uris: Uri[]) => Promise<TypeScriptWorker>
> {
    return getWorker('typescript');
}

export function getWorker(
    modeId: string
): Promise<(...uris: Uri[]) => Promise<TypeScriptWorker>> {
    return new Promise((resolve, reject) => {
        if (!workers.has(modeId)) {
            return reject(`${modeId} not registered!`);
        }

        resolve(workers.get(modeId));
    });
}

function setupMode(
    defaults: LanguageServiceDefaults,
    modeId: string
): (...uris: Uri[]) => Promise<TypeScriptWorker> {
    const client = new WorkerManager(modeId, defaults);
    const worker = (...uris: Uri[]): Promise<TypeScriptWorker> => {
        return client.getLanguageServiceWorker(...uris);
    };

    const libFiles = new languageFeatures.LibFiles(worker);

    languages.registerCompletionItemProvider(
        modeId,
        new languageFeatures.SuggestAdapter(worker)
    );
    languages.registerSignatureHelpProvider(
        modeId,
        new languageFeatures.SignatureHelpAdapter(worker)
    );
    languages.registerHoverProvider(
        modeId,
        new languageFeatures.QuickInfoAdapter(worker)
    );
    languages.registerDocumentHighlightProvider(
        modeId,
        new languageFeatures.OccurrencesAdapter(worker)
    );
    languages.registerDefinitionProvider(
        modeId,
        new languageFeatures.DefinitionAdapter(libFiles, worker)
    );
    languages.registerReferenceProvider(
        modeId,
        new languageFeatures.ReferenceAdapter(libFiles, worker)
    );
    languages.registerDocumentSymbolProvider(
        modeId,
        new languageFeatures.OutlineAdapter(worker)
    );
    languages.registerDocumentRangeFormattingEditProvider(
        modeId,
        new languageFeatures.FormatAdapter(worker)
    );
    languages.registerOnTypeFormattingEditProvider(
        modeId,
        new languageFeatures.FormatOnTypeAdapter(worker)
    );
    languages.registerCodeActionProvider(
        modeId,
        new languageFeatures.CodeActionAdaptor(worker)
    );
    languages.registerRenameProvider(
        modeId,
        new languageFeatures.RenameAdapter(worker)
    );
    new languageFeatures.DiagnosticsAdapter(libFiles, defaults, modeId, worker);

    return worker;
}
