import { customPortalLanguageId } from './custom-portal-typescript/custom-portal-typescript.contribution';
import { languages } from './typescript/fillers/monaco-editor-core';
import {
    JsxEmit,
    LanguageServiceDefaults,
    LanguageServiceDefaultsImpl,
    NewLineKind,
    ScriptTarget,
} from './typescript/languageService';
import { libFileMap } from 'monaco-editor/esm/vs/language/typescript/lib/lib.js';
import { setupLangaugeMode } from './typescript/tsMode';

export const customPortalTypescriptDefaults: LanguageServiceDefaults = new LanguageServiceDefaultsImpl(
    { allowNonTsExtensions: true, target: ScriptTarget.Latest },
    { noSemanticValidation: false, noSyntaxValidation: false },
    {}
);

export const customPortalJavaScriptDefaults: LanguageServiceDefaults = new LanguageServiceDefaultsImpl(
    { allowNonTsExtensions: true, allowJs: true, target: ScriptTarget.Latest },
    { noSemanticValidation: true, noSyntaxValidation: false },
    {}
);

// Set diagnostics
customPortalJavaScriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
});

// Set compiler options
customPortalJavaScriptDefaults.setCompilerOptions({
    target: ScriptTarget.ES2015,

    // Auto-import the given libraries
    lib: ['defaultLib:lib.es2015.d.ts', 'defaultLib:lib.dom.d.ts'],

    allowJs: true,
    alwaysStrict: true,
    checkJs: true,
    newLine: NewLineKind.LineFeed,
    noEmit: true,
    jsx: JsxEmit.Preserve,
});
customPortalTypescriptDefaults.setCompilerOptions({
    target: ScriptTarget.ES2015,

    // Auto-import the given libraries
    lib: ['defaultLib:lib.es2015.d.ts', 'defaultLib:lib.dom.d.ts'],

    allowJs: true,
    alwaysStrict: true,
    checkJs: true,
    newLine: NewLineKind.LineFeed,
    noEmit: true,
    jsx: JsxEmit.Preserve,
});

// Eagerly sync models to get intellisense for all models
customPortalJavaScriptDefaults.setEagerModelSync(true);

// Register the ES2015 core library
customPortalJavaScriptDefaults.addExtraLib(
    libFileMap['lib.es2015.d.ts'],
    'defaultLib:lib.es2015.d.ts'
);

// Register the DOM library
customPortalJavaScriptDefaults.addExtraLib(
    libFileMap['lib.dom.d.ts'],
    'defaultLib:lib.dom.d.ts'
);

// --- Registration to monaco editor ---

languages.onLanguage('custom-portal-typescript', () => {
    return setupLangaugeMode(
        'custom-portal-typescript',
        customPortalTypescriptDefaults
    );
});
languages.onLanguage(customPortalLanguageId, () => {
    return setupLangaugeMode(
        customPortalLanguageId,
        customPortalJavaScriptDefaults
    );
});
