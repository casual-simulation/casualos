import { Uri, editor } from '@casual-simulation/monaco-editor';
import AuxScriptWorker from './worker?worker';
import { wrap } from 'comlink';
import type {
    AuxScriptBackend,
    AuxScriptBackendStatic,
} from './AuxScriptBackend';
import {
    SuggestAdapter,
    SignatureHelpAdapter,
    QuickInfoAdapter,
    DocumentHighlightAdapter,
    DefinitionAdapter,
    ReferenceAdapter,
    OutlineAdapter,
    RenameAdapter,
    FormatAdapter,
    FormatOnTypeAdapter,
    CodeActionAdaptor,
    InlayHintsAdapter,
    DiagnosticsAdapter,
} from './LanguageFeatures';

const libFiles: any = {};

export async function setupAuxScript(languageId: string) {
    const AuxScriptBackend = wrap<AuxScriptBackendStatic>(
        new AuxScriptWorker()
    );

    const backend = await new AuxScriptBackend();

    const getWorker = async (...uris: Uri[]): Promise<AuxScriptBackend> => {
        return backend;
    };

    const languages = editor.languages;

    languages.registerCompletionItemProvider(
        languageId,
        new SuggestAdapter(getWorker)
    );
    languages.registerSignatureHelpProvider(
        languageId,
        new SignatureHelpAdapter(getWorker)
    );

    languages.registerHoverProvider(
        languageId,
        new QuickInfoAdapter(getWorker)
    );
    languages.registerDocumentHighlightProvider(
        languageId,
        new OccurrencesAdapter(getWorker)
    );
    languages.registerDefinitionProvider(
        languageId,
        new DefinitionAdapter(libFiles, getWorker)
    );
    languages.registerReferenceProvider(
        languageId,
        new ReferenceAdapter(libFiles, getWorker)
    );

    languages.registerDocumentSymbolProvider(
        languageId,
        new OutlineAdapter(getWorker)
    );

    languages.registerRenameProvider(
        languageId,
        new RenameAdapter(libFiles, getWorker)
    );

    languages.registerDocumentRangeFormattingEditProvider(
        languageId,
        new FormatAdapter(getWorker)
    );

    languages.registerOnTypeFormattingEditProvider(
        languageId,
        new FormatOnTypeAdapter(getWorker)
    );

    languages.registerCodeActionProvider(
        languageId,
        new CodeActionAdaptor(getWorker)
    );
    languages.registerInlayHintsProvider(
        languageId,
        new InlayHintsAdapter(getWorker)
    );
    const diagnostics = new DiagnosticsAdapter(
        libFiles,
        defaults,
        languageId,
        getWorker
    );
}
