// @ts-nocheck

let monaco = null, j = null;

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
        options: (elementName) => (
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

export const configureLocToMonacoRange = (
    _monaco = monaco, parser = 'babylon'
) => {
    switch (parser) {
        case 'babylon':
        default:
            return (
                loc,
                startLineOffset = 0,
                startColumnOffset = 0,
                endLineOffset = 0,
                endColumnOffset = 0,
            ) => {
                if (!loc || !loc.start) {
                    return new _monaco.Range(1, 1, 1, 1);
                }
                return new _monaco.Range(
                    startLineOffset + loc.start.line,
                    startColumnOffset + loc.start.column + 1,
                    endLineOffset + loc.end ?
                        loc.end.line
                        : loc.start.line,
                    endColumnOffset + loc.end ?
                        loc.end.column + 1
                        : loc.start.column + 1,
                );
            };
    }
};

class MonacoJSXHighlighter {
    commentActionId = "editor.action.commentLine";
    commandActionId = "jsx-comment-edit";
    _isHighlightBoundToModelContentChanges = false;
    _isGetJSXCommentActive = false;
    _isEditorDisposed = false;

    constructor(
        monacoRef,
        jRef,
        monacoEditor,
        options = {},
    ) {
        monaco = monacoRef;
        j = jRef;
        this.locToMonacoRange = configureLocToMonacoRange(monaco);
        this.monacoEditor = monacoEditor;
        this.options = {...defaultOptions, ...options};
    }

    getAstPromise = () => new Promise((resolve) => {
        resolve(j(this.monacoEditor.getValue()));
    });

    highLightOnDidChangeModelContent = (
        afterHighlight = ast => ast,
        onError = error => console.error(error),
        getAstPromise = this.getAstPromise,
        onJsCodeShiftErrors = error => console.log(error),
    ) => {
        this.highlightCode(
            afterHighlight, onError, getAstPromise, onJsCodeShiftErrors
        );

        let highlighterDisposer = this.monacoEditor.onDidChangeModelContent(
            () => this.highlightCode(
                afterHighlight, onError, getAstPromise, onJsCodeShiftErrors
            )
        );
        this._isHighlightBoundToModelContentChanges = true;

        this.monacoEditor.onDidDispose(() => {
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
            this.monacoEditor.deltaDecorations(
                this.JSXDecoratorIds || [],
                [],
            );
            highlighterDisposer = null;
            this._isHighlightBoundToModelContentChanges = false;
        };
    };

    highlightCode = (
        afterHighlight = ast => ast,
        onError = error => console.error(error),
        getAstPromise = this.getAstPromise,
        onJsCodeShiftErrors = error => error,
    ) =>
        (
            getAstPromise()
                .then(ast => this.highlight(ast))
                .catch(onJsCodeShiftErrors)
        )
            .then(afterHighlight)
            .catch(onError);

    highlight = (ast) => {
        return new Promise((resolve) => {
            if (ast) {
                this.ast = ast;
                this.decorators = this.extractAllDecorators(ast);
                resolve(ast);
            }
        });

    };

    extractAllDecorators = (ast) => {
        const decorators = this.createJSXElementDecorators(ast);
        for (const jsxType in JSXTypes) {
            this.createDecoratorsByType(
                ast,
                jsxType,
                JSXTypes[jsxType].options,
                JSXTypes[jsxType].highlightScope,
                decorators,
            );
        }
        this.JSXDecoratorIds =
            this.monacoEditor.deltaDecorations(
                this.JSXDecoratorIds || [],
                decorators,
            );
        return decorators;
    }

    createJSXElementDecorators = (
        ast,
        decorators = [],
        highlighterOptions = this.options,
    ) => {
        ast
            .findJSXElements()
            .forEach(p => {
                const loc = p.value.loc;
                const openingElement = p.value.openingElement;
                let elementName = null;
                if (openingElement) {
                    const oLoc = openingElement.loc;
                    elementName = openingElement.name.name;
                    decorators.push({
                        range: new monaco.Range(
                            oLoc.start.line,
                            oLoc.start.column + 1,
                            oLoc.start.line,
                            oLoc.start.column + 2
                        ),
                        options: highlighterOptions.isUseSeparateElementStyles ?
                            JSXTypes.JSXBracket.openingElementOptions
                            : JSXTypes.JSXBracket.options,
                    });
                    decorators.push({
                        range: new monaco.Range(
                            oLoc.end.line,
                            oLoc.end.column + (
                                openingElement.selfClosing ? -1 : 0
                            ),
                            oLoc.end.line,
                            oLoc.end.column + 1
                        ),
                        options: highlighterOptions.isUseSeparateElementStyles ?
                            JSXTypes.JSXBracket.openingElementOptions
                            : JSXTypes.JSXBracket.options,
                    });
                }
                const closingElement = p.value.closingElement;
                if (closingElement) {
                    const cLoc = closingElement.loc;
                    decorators.push({
                        range: new monaco.Range(
                            cLoc.start.line,
                            cLoc.start.column + 1,
                            cLoc.start.line,
                            cLoc.start.column + 3
                        ),
                        options: highlighterOptions.isUseSeparateElementStyles ?
                            JSXTypes.JSXBracket.closingElementOptions
                            : JSXTypes.JSXBracket.options,
                    });
                    decorators.push({
                        range: new monaco.Range(
                            cLoc.end.line,
                            cLoc.end.column,
                            cLoc.end.line,
                            cLoc.end.column + 1
                        ),
                        options: highlighterOptions.isUseSeparateElementStyles ?
                            JSXTypes.JSXBracket.closingElementOptions
                            : JSXTypes.JSXBracket.options,
                    });
                }

                highlighterOptions.isHighlightGlyph && decorators.push({
                    range: this.locToMonacoRange(loc),
                    options: JSXTypes.JSXElement.options(elementName),
                });
            });
        return decorators;
    };

    getJSXContext = (selection, ast, editor = this.monacoEditor) => {

        const range = new monaco.Range(
            selection.startLineNumber,
            0,
            selection.startLineNumber,
            0
        );


        let minRange = null;
        let path = null;

        ast && ast.findJSXElements().forEach(p => {
            const loc = p.value.loc;
            const _range = this.locToMonacoRange(loc);

            if (_range.intersectRanges(range)) {
                if (!minRange || minRange.containsRange(_range)) {
                    minRange = _range;
                    path = p;
                }
            }
        });
        let leftmostNode = null;
        let leftmostJsxTextNode = null;
        let leftmostNodeRange = null;
        let leftmostJsxTextNodeRange = null;

        if (path) {
            const {children = []} = path.value || {};
            const getLeftMostNode = node => {
                const loc = node && node.loc;
                const _range = loc && this.locToMonacoRange(loc);

                if (node.type === 'JSXText') {
                    if (!leftmostNode && _range.containsRange(range)) {
                        leftmostJsxTextNode = node;
                        leftmostJsxTextNodeRange = _range;
                    }
                } else {
                    if (_range &&
                        _range.startLineNumber === range.startLineNumber) {
                        if (
                            !leftmostNode ||
                            _range.startColumn < leftmostNodeRange.startColumn
                        ) {
                            leftmostNode = node;
                            leftmostNodeRange = _range;

                        }
                    }

                }
            }
            children.forEach(getLeftMostNode);
        }
        let commentContext = leftmostNode || leftmostJsxTextNode ?
            JSXCommentContexts.JSX : JSXCommentContexts.JS;
        return commentContext;
    };

    getJSXCommentContext = (
        selection,
        getAstPromise = this.getAstPromise,
        onJsCodeShiftErrors = error => error,
        editor = this.monacoEditor
    ) => {
        return new Promise((resolve) => {
                if (this._isHighlightBoundToModelContentChanges) {
                    resolve(this.getJSXContext(selection, this.ast, editor));
                } else {
                    getAstPromise().then(ast => {
                        resolve(this.getJSXContext(selection, ast, editor));
                    })
                        .catch(
                            (error) => resolve(
                                this.getJSXContext(selection, null, editor)
                            ) || onJsCodeShiftErrors(error)
                        )
                }
            }
        ).catch(onJsCodeShiftErrors);
    };

    executeEditorEdits = (
        range,
        text,
        editor = this.monacoEditor,
        identifier = {major: 1, minor: 1},
        forceMoveMarkers = true,
        commandId = "jsx-comment-edit",
    ) => {
        const op = {
            identifier: {major: 1, minor: 1},
            range,
            text,
            forceMoveMarkers,
        };
        editor.executeEdits(commandId, [op]);
    };

    addJSXCommentCommand = (
        getAstPromise = this.getAstPromise,
        onJsCodeShiftErrors = error => error,
        editor = this.monacoEditor,
    ) => {
        this._isGetJSXCommentActive = true;
        this._editorCommandId = editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.US_SLASH,
            () => {
                if (!this._isGetJSXCommentActive) {
                    editor.getAction(this.commentActionId).run();
                    return;
                }
                const selection = editor.getSelection();
                const model = editor.getModel();

                this.getJSXCommentContext(
                    selection,
                    getAstPromise,
                    onJsCodeShiftErrors,
                    editor,
                ).then((commentContext) => {


                    let isUnCommentAction = true;

                    const commentsData = [];

                    for (let i = selection.startLineNumber;
                         i <= selection.endLineNumber;
                         i++) {
                        const commentRange = new monaco.Range(
                            i,
                            model.getLineFirstNonWhitespaceColumn(i),
                            i,
                            model.getLineMaxColumn(i),
                        );

                        const commentText = model.getValueInRange(commentRange);

                        commentsData.push({
                            commentRange,
                            commentText
                        });

                        isUnCommentAction = isUnCommentAction &&
                            !!commentText.match(/{\/\*/);
                    }


                    if (commentContext !== JSXCommentContexts.JSX
                        && !isUnCommentAction) {
                        editor.getAction(this.commentActionId).run();
                        return;
                    }

                    let editOperations = [];
                    let commentsDataIndex = 0;

                    for (let i = selection.startLineNumber;
                         i <= selection.endLineNumber;
                         i++) {
                        let {
                            commentText,
                            commentRange,
                        } = commentsData[commentsDataIndex++];

                        if (isUnCommentAction) {
                            commentText = commentText.replace(/{\/\*/, '');
                            commentText = commentText.replace(/\*\/}/, '');
                        } else {
                            commentText = `{/*${commentText}*/}`;
                        }

                        editOperations.push({
                            identifier: {major: 1, minor: 1},
                            range: commentRange,
                            text: commentText,
                            forceMoveMarkers: true,
                        });
                    }
                    editOperations.length &&
                    editor.executeEdits(this._editorCommandId, editOperations);
                    /*commandActionId*/
                });

            });

        this.monacoEditor.onDidDispose(() => {
            this._isEditorDisposed = true;
            this._isGetJSXCommentActive = false;
        });

        return () => {
            this._isGetJSXCommentActive = false;
        }
    }

    createDecoratorsByType = (
        ast,
        jsxType,
        jsxTypeOptions,
        highlightScope,
        decorators = [],
        highlighterOptions = this.options,
        extractDecorators = p => {
            const loc = p.value.loc;
            const options = highlighterOptions.iShowHover ?
                {...jsxTypeOptions, ...{hoverMessage: `(${jsxType})`}}
                : jsxTypeOptions;
            decorators.push({
                range: this.locToMonacoRange(loc),
                options
            });
        }
    ) => {
        ast.find(j[jsxType])
            .forEach(p => {
                switch (highlightScope) {
                    case HIGHLIGHT_SCOPE.IDENTIFIER:
                        j(p).find(j.JSXIdentifier)
                            .forEach(extractDecorators);
                        break;
                    case HIGHLIGHT_SCOPE.ALL:
                        extractDecorators(p);
                }
            });

        return decorators;
    };
}

export default MonacoJSXHighlighter;