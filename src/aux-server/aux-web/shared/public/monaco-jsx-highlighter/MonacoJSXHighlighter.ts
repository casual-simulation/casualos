import * as monaco from '../../MonacoLibs';
import { Transpiler } from '@casual-simulation/aux-common';
import { reject } from 'lodash';
import estraverse from 'estraverse';

const defaultOptions = {
    isHighlightGlyph: false,
    iShowHover: false,
    isUseSeparateElementStyles: false,
};

const HIGHLIGHT_SCOPE = {
    ALL: 'ALL',
    IDENTIFIER: 'IDENTIFIER',
    LOCAL: 'LOCAL',
    EXTRA: 'EXTRA',
};

export const JSXTypes = {
    JSXBracket: {
        highlightScope: HIGHLIGHT_SCOPE.LOCAL,
        options: {
            inlineClassName: 'mtk100.Identifier.JsxElement.Bracket',
        },
        openingElementOptions: {
            inlineClassName: 'mtk1000.Identifier.JsxOpeningElement.Bracket',
        },
        closingElementOptions: {
            inlineClassName: 'mtk1001.Identifier.JsxClosingElement.Bracket',
        },
    },
    JSXOpeningElement: {
        highlightScope: HIGHLIGHT_SCOPE.IDENTIFIER,
        options: {
            inlineClassName: 'mtk101.Identifier.JsxOpeningElement.Identifier',
        },
    },
    JSXClosingElement: {
        highlightScope: HIGHLIGHT_SCOPE.IDENTIFIER,
        options: {
            inlineClassName: 'mtk102.Identifier.JsxClosingElement.Identifier ',
        },
    },
    JSXAttribute: {
        highlightScope: HIGHLIGHT_SCOPE.IDENTIFIER,
        options: {
            inlineClassName: 'mtk103.Identifier.JsxAttribute.Identifier ',
        },
    },
    JSXText: {
        highlightScope: HIGHLIGHT_SCOPE.ALL,
        options: {
            inlineClassName: 'mtk104.JsxElement.JsxText',
        },
    },
    JSXElement: {
        highlightScope: HIGHLIGHT_SCOPE.EXTRA,
        options: (elementName: string) => (
            {
                glyphMarginClassName: 'mtk105.glyph.Identifier.JsxElement',
                glyphMarginHoverMessage:
                    `JSX Element${elementName ? ': ' + elementName : ''}`
            }
        ),
    },
};

export const JSXCommentContexts = {
    JS: 'JS',
    JSX: 'JSX'
}

interface NodeWithLocations {
    start: number;
    end: number;
    loc: LOC;
}

interface LOC {
    start: { line: number; column: number };
    end: { line: number; column: number };
}

interface MonacoJSXHighlighterOptions {
    isHighlightGlyph: boolean,
    iShowHover: boolean,
    isUseSeparateElementStyles: boolean,
}

class MonacoJSXHighlighter {
    commentActionId = "editor.action.commentLine";
    commandActionId = "jsx-comment-edit";

    options: MonacoJSXHighlighterOptions;

    private _isHighlightBoundToModelContentChanges = false;
    private _isGetJSXCommentActive = false;
    private _isEditorDisposed = false;

    private _transpiler: Transpiler;
    private _monacoEditor: monaco.editor.ICodeEditor;
    private _decoratorIds: string[];
    private _lineOffset: number = 0;

    private _locToMonacoRange(node: NodeWithLocations): monaco.Range {
        if (!node || !node.start) {
            return new monaco.Range(1, 1, 1, 1);
        }
        return new monaco.Range(
            this._getActualLineNumber(node.loc.start.line),
            node.loc.start.column + 1,
            this._getActualLineNumber(node.end ?
                node.loc.end.line
                : node.loc.start.line),
            node.end ?
                node.loc.end.column + 1
                : node.loc.start.column + 1,
        );
    }

    constructor(
        transpiler: Transpiler,
        monacoEditor: monaco.editor.ICodeEditor,
        options: Partial<MonacoJSXHighlighterOptions> = {},
    ) {
        this._transpiler = transpiler;
        this._monacoEditor = monacoEditor;
        this.options = {...defaultOptions, ...options};
    }

    getAstPromise = () => new Promise((resolve) => {
        try {
            let script = this._monacoEditor.getValue();
            if (script.indexOf('await ') >= 0) {
                script = `async function _() {\n${script}\n}`;
                this._lineOffset = -1;
            } else {
                this._lineOffset = 0;
            }
            resolve(this._transpiler.parse(script));
        } catch (e) {
            reject(e);
        }
    });

    highLightOnDidChangeModelContent = (
        afterHighlight = (ast: any) => ast,
        onError = (error: any) => console.error(error),
        getAstPromise = this.getAstPromise,
        onJsCodeShiftErrors = (error: any) => console.log(error),
    ) => {
        this.highlightCode(
            afterHighlight, onError, getAstPromise, onJsCodeShiftErrors
        );

        let highlighterDisposer = this._monacoEditor.onDidChangeModelContent(
            () => this.highlightCode(
                afterHighlight, onError, getAstPromise, onJsCodeShiftErrors
            )
        );
        this._isHighlightBoundToModelContentChanges = true;

        this._monacoEditor.onDidDispose(() => {
            highlighterDisposer = null;
            this._isEditorDisposed = true;
            this._isHighlightBoundToModelContentChanges = false;
        });
        return () => {
            if (this._isEditorDisposed ||
                !this._isHighlightBoundToModelContentChanges
            ) {
                return;
            }
            highlighterDisposer.dispose();
            this._monacoEditor.deltaDecorations(
                this._decoratorIds || [],
                [],
            );
            highlighterDisposer = null;
            this._isHighlightBoundToModelContentChanges = false;
        };
    };

    highlightCode = (
        afterHighlight = (ast: any) => ast,
        onError = (error: any) => console.error(error),
        getAstPromise = this.getAstPromise,
        onJsCodeShiftErrors = (error: any) => error,
    ) =>
        (
            getAstPromise()
                .then(ast => this.highlight(ast))
                .catch(onJsCodeShiftErrors)
        )
            .then(afterHighlight)
            .catch(onError);

    highlight = (ast: any) => {
        return new Promise((resolve) => {
            if (ast) {
                this.extractAllDecorators(ast);
                resolve(ast);
            }
        });
    };

    private _traverse(node: any, enter: (node: any) => any) {
        return estraverse.traverse(node, {
            enter: (node: any) => {
                return enter(node);
            },

            keys: {
                JSXElement: ['openingElement', 'closingElement', 'children'],
                JSXFragment: ['children'],
                JSXOpeningElement: ['name', 'attributes'],
                JSXClosingElement: ['name'],
                JSXText: [],
                JSXExpressionContainer: ['expression'],
                JSXIdentifier: [],
                JSXAttribute: ['name', 'value'],
                JSXSpreadAttribute: []
            },
        });
    }

    extractAllDecorators = (ast: any) => {
        let decorators = [] as monaco.editor.IModelDeltaDecoration[];

        this._traverse(ast, (node) => {
            if (node.type === 'JSXElement') {
                this.createJSXElementDecorators(node, decorators);
            }

            if (node.type in JSXTypes) {
                this.createDecoratorForType(node, node.type, (<any>JSXTypes)[node.type].options, (<any>JSXTypes)[node.type].highlightScope, decorators);
            }
        });

        // for (const jsxType in JSXTypes) {
        //     this.createDecoratorsByType(
        //         ast,
        //         jsxType,
        //         JSXTypes[jsxType].options,
        //         JSXTypes[jsxType].highlightScope,
        //         decorators,
        //     );
        // }
        this._decoratorIds =
            this._monacoEditor.deltaDecorations(
                this._decoratorIds || [],
                decorators,
            );
        return decorators;
    }

    createJSXElementDecorators(node: any, decorators: monaco.editor.IModelDeltaDecoration[]) {
        const openingElement = node.openingElement;
        let elementName: string = null;
        if (openingElement) {
            elementName = this.createJSXOpeningElementDecorator(openingElement, decorators);
        }
        const closingElement = node.closingElement;
        if (closingElement) {
            this.createJSXClosingElementDecorator(closingElement, decorators);
        }

        if (elementName && this.options.isHighlightGlyph) {
            decorators.push({
                range: this._locToMonacoRange(node),
                options: JSXTypes.JSXElement.options(elementName) as any,
            })
        }
    }

    createJSXOpeningElementDecorator(openingElement: any, decorators: monaco.editor.IModelDeltaDecoration[]): string {
        const oLoc = openingElement.loc;
        const elementName = openingElement.name.name;
        decorators.push({
            range: new monaco.Range(
                this._getActualLineNumber(oLoc.start.line),
                oLoc.start.column + 1,
                this._getActualLineNumber(oLoc.start.line),
                oLoc.start.column + 2
            ),
            options: this.options.isUseSeparateElementStyles ?
                JSXTypes.JSXBracket.openingElementOptions
                : JSXTypes.JSXBracket.options,
        });
        decorators.push({
            range: new monaco.Range(
                this._getActualLineNumber(oLoc.end.line),
                oLoc.end.column + (
                    openingElement.selfClosing ? -1 : 0
                ),
                this._getActualLineNumber(oLoc.end.line),
                oLoc.end.column + 1
            ),
            options: this.options.isUseSeparateElementStyles ?
                JSXTypes.JSXBracket.openingElementOptions
                : JSXTypes.JSXBracket.options,
        });
        return elementName;
    }

    createJSXClosingElementDecorator(closingElement: any, decorators: monaco.editor.IModelDeltaDecoration[]) {
        const cLoc = closingElement.loc;
        decorators.push({
            range: new monaco.Range(
                this._getActualLineNumber(cLoc.start.line),
                cLoc.start.column + 1,
                this._getActualLineNumber(cLoc.start.line),
                cLoc.start.column + 3
            ),
            options: this.options.isUseSeparateElementStyles ?
                JSXTypes.JSXBracket.closingElementOptions
                : JSXTypes.JSXBracket.options,
        });
        decorators.push({
            range: new monaco.Range(
                this._getActualLineNumber(cLoc.end.line),
                cLoc.end.column,
                this._getActualLineNumber(cLoc.end.line),
                cLoc.end.column + 1
            ),
            options: this.options.isUseSeparateElementStyles ?
                JSXTypes.JSXBracket.closingElementOptions
                : JSXTypes.JSXBracket.options,
        });
    }

    createDecoratorForType(node: any, jsxType: string, jsxOptions: any, highlightScope: keyof typeof HIGHLIGHT_SCOPE, decorators: monaco.editor.IModelDeltaDecoration[]) {
        const extractDecorator = (node: any) => {
            const options = this.options.iShowHover ?
                {...jsxOptions, ...{hoverMessage: `(${jsxType})`}}
                : jsxOptions;

            decorators.push({
                range: this._locToMonacoRange(node),
                options
            });
        };
        
        switch(highlightScope) {
            case HIGHLIGHT_SCOPE.IDENTIFIER:
                this._traverse(node, (child) => {
                    if (child.type === 'JSXIdentifier') {
                        extractDecorator(child);
                    }
                });
            break;
            case HIGHLIGHT_SCOPE.ALL:
                extractDecorator(node);
            break;
        }
    }

    private _getActualLineNumber(lineNumber: number) {
        return lineNumber + this._lineOffset;
    }
}

export default MonacoJSXHighlighter;