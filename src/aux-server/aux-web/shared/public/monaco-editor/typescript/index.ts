import {
    setupJavaScript,
    setupTypeScript,
    getTypeScriptWorker,
    getJavaScriptWorker,
} from './tsMode';
import { languages, Uri } from './fillers/monaco-editor-core';
import {
    ModuleKind,
    JsxEmit,
    NewLineKind,
    ScriptTarget,
    ModuleResolutionKind,
    TypeScriptWorker,
    LanguageServiceDefaults,
    LanguageServiceDefaultsImpl,
} from './languageService';
import { typescriptVersion as tsversion } from './lib/typescriptServicesMetadata'; // do not import the whole typescriptServices here

export const typescriptVersion: string = tsversion;

export const typescriptDefaults: LanguageServiceDefaults = new LanguageServiceDefaultsImpl(
    { allowNonTsExtensions: true, target: ScriptTarget.Latest },
    { noSemanticValidation: false, noSyntaxValidation: false },
    {}
);

export const javascriptDefaults: LanguageServiceDefaults = new LanguageServiceDefaultsImpl(
    { allowNonTsExtensions: true, allowJs: true, target: ScriptTarget.Latest },
    { noSemanticValidation: true, noSyntaxValidation: false },
    {}
);

// export to the global based API
(<any>languages).typescript = {
    ModuleKind,
    JsxEmit,
    NewLineKind,
    ScriptTarget,
    ModuleResolutionKind,
    typescriptVersion,
    typescriptDefaults,
    javascriptDefaults,
    getTypeScriptWorker,
    getJavaScriptWorker,
};

// --- Registration to monaco editor ---

languages.onLanguage('typescript', () => {
    return setupTypeScript(typescriptDefaults);
});
languages.onLanguage('javascript', () => {
    return setupJavaScript(javascriptDefaults);
});
