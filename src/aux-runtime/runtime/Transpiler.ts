/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import * as Acorn from 'acorn';
import { generate, GENERATOR } from 'astring';
import LRUCache from 'lru-cache';
import { traverse, VisitorKeys } from 'estraverse';
import type { Text } from 'yjs';
import {
    createAbsolutePositionFromRelativePosition,
    createRelativePositionFromTypeIndex,
    getItem,
    Doc,
} from 'yjs';
import {
    createAbsolutePositionFromStateVector,
    createRelativePositionFromStateVector,
    getClock,
    getTextChar,
} from '@casual-simulation/aux-common/yjs/YjsHelpers';
import type { VersionVector } from '@casual-simulation/aux-common';
import type { CodeLocation } from './TranspilerUtils';
import {
    calculateIndexFromLocation,
    calculateLocationFromIndex,
} from './TranspilerUtils';
import { tsPlugin } from 'acorn-typescript';

/**
 * The symbol that is used in script dependencies to represent any argument.
 */
export const anyArgument = Symbol('anyArgument');

declare module 'acorn' {
    /**
     * Extends the acorn parser interface.
     */
    interface Parser {
        type: Acorn.TokenType;
        start: number;
        startLoc: number;
        value: string;
        pos: number;
        next(): void;
        parseLiteral(value: string): Acorn.Node;
        parseIdent(): Acorn.Node;
        parseExprSubscripts(): Acorn.Node;
        parseSubscript(
            base: Acorn.Node,
            startPos: number,
            startLoc: number
        ): Acorn.Node;
        unexpected(): void;
        startNodeAt(start: number, startLoc: number): Acorn.Node;
        readToken(code: number): any;
        finishToken(token: Acorn.TokenType): any;
        finishNode(node: Acorn.Node, type: string): Acorn.Node;
        parseExprAtom(refShortHandDefaultPos: any): Acorn.Node;
        parseParenAndDistinguishExpression(canBeArrow: boolean): Acorn.Node;
    }
}

export type ExJsNode = TokenValueNode | ObjectValueNode;

export interface TokenValueNode extends Acorn.Node {
    type: 'TokenValue';
    identifier: Acorn.Node;
}

export interface ObjectValueNode extends Acorn.Node {
    type: 'ObjectValue';
    identifier: Acorn.Node;
}

const exJsGenerator = Object.assign({}, GENERATOR, {
    ImportExpression: function (node: any, state: any) {
        state.write('import(');
        this[node.source.type](node.source, state);
        state.write(')');
    },
});

export interface TranspilerMacro {
    test: RegExp;
    replacement: (val: string) => string;
}

/**
 * The estraverse visitor keys that are used for TypeScript nodes.
 */
export const TypeScriptVisistorKeys: { [nodeType: string]: string[] } = {
    TSTypeParameterDeclaration: [],
    TSCallSignatureDeclaration: [],
    TSConstructSignatureDeclaration: [],
    TSInterfaceDeclaration: [],
    TSModuleDeclaration: [],
    TSEnumDeclaration: [],
    TSTypeAliasDeclaration: [],
    TSDeclareFunction: [],
    TSDeclareMethod: [],

    TSExternalModuleReference: [],
    TSQualifiedName: [],
    TSEnumMember: [],

    TSModuleBlock: [],
    TSTypePredicate: [],
    TSThisType: [],
    TSTypeAnnotation: [],
    TSLiteralType: [],
    TSVoidKeyword: [],
    TSNeverKeyword: [],
    TSNumberKeyword: [],
    TSAnyKeyword: [],
    TSBooleanKeyword: [],
    TSBigIntKeyword: [],
    TSObjectKeyword: [],
    TSStringKeyword: [],
    TSSymbolKeyword: [],
    TSUndefinedKeyword: [],
    TSUnknownKeyword: [],
    TSFunctionType: [],
    TSConstructorType: [],
    TSUnionType: [],
    TSIntersectionType: [],
    TSInferType: [],
    TSImportType: [],
    TSTypeQuery: [],
    TSTypeParameter: [],
    TSMappedType: [],
    TSTypeLiteral: [],
    TSTupleType: [],
    TSNamedTupleMember: [],
    TSRestType: [],
    TSOptionalType: [],
    TSTypeReference: [],
    TSParenthesizedType: [],
    TSArrayType: [],
    TSIndexedAccessType: [],
    TSConditionalType: [],
    TSIndexSignature: [],
    TSTypeParameterInstantiation: [],
    TSExpressionWithTypeArguments: [],
    TSInterfaceBody: [],
    TSIntrinsicKeyword: [],
    TSImportEqualsDeclaration: [],
    TSNonNullExpression: [],
    TSTypeOperator: [],
    TSMethodSignature: [],
    TSPropertySignature: [],
    TSAsExpression: [],
    TSParameterProperty: ['parameter'],

    ClassDeclaration: [
        ...VisitorKeys.ClassDeclaration,
        'implements',
        'typeParameters',
    ],
    ClassExpression: [
        ...VisitorKeys.ClassExpression,
        'implements',
        'typeParameters',
    ],
    VariableDeclarator: [...VisitorKeys.VariableDeclarator, 'typeAnnotation'],
    FunctionDeclaration: [
        ...VisitorKeys.FunctionDeclaration,
        'returnType',
        'typeParameters',
    ],
    FunctionExpression: [
        ...VisitorKeys.FunctionExpression,
        'returnType',
        'typeParameters',
    ],
    Identifier: [...VisitorKeys.Identifier, 'typeAnnotation'],
    PropertyDefinition: [
        ...(VisitorKeys as any).PropertyDefinition,
        'typeAnnotation',
    ],
};

/**
 * The list of macros that the sandbox uses on the input code before transpiling it.
 */
const MACROS: TranspilerMacro[] = [
    {
        test: /^(?:🧬)/g,
        replacement: (val) => '',
    },
];

/**
 * The list of node types that have their own async scopes. To be ignored in _isAsyncNode.
 */
const asyncBoundaryNodes = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'MethodDefinition',
    'ClassDeclaration',
    'ClassExpression',
    'ObjectMethod',
    'ClassMethod',
]);

/**
 * Replaces macros in the given text.
 * @param text The text that the macros should be replaced in.
 */
export function replaceMacros(text: string) {
    if (!text) {
        return text;
    }

    for (let m of MACROS) {
        text = text.replace(m.test, m.replacement);
    }

    return text;
}

export interface TranspilerOptions {
    jsxFactory?: string;
    jsxFragment?: string;
    forceSync?: boolean;

    /**
     * The name of the function that should be called for ES Module imports.
     */
    importFactory?: string;

    /**
     * The name of the variable that should be used to access the import.meta object.
     */
    importMetaFactory?: string;

    /**
     * The name of the function that should be called for ES Module exports.
     */
    exportFactory?: string;
}

/**
 * Defines a class that is able to compile code from AUX's custom JavaScript dialect
 * into pure ES6 JavaScript. Does not preserve spacing or comments.
 *
 * See https://docs.google.com/document/d/1WQXQPjdXxyx_lau15WPpwTTYvt66_wPCu3x-08rpLoY/edit?usp=sharing
 */
export class Transpiler {
    private _parser: typeof Acorn.Parser;
    private _jsxFactory: string;
    private _jsxFragment: string;
    private _importFactory: string;
    private _importMetaFactory: string;
    private _exportFactory: string;
    private _forceSync: boolean;
    private _cache: LRUCache<string, TranspilerResult>;

    get forceSync() {
        return this._forceSync;
    }

    set forceSync(value: boolean) {
        this._forceSync = value;
    }

    constructor(options?: TranspilerOptions) {
        this._cache = new LRUCache<string, TranspilerResult>({
            max: 1000,
        });
        this._parser = Acorn.Parser.extend(tsPlugin() as any);

        (this._parser.prototype as any).parseReturnStatement = function (
            node: any
        ) {
            this.next();

            // In `return` (and `break`/`continue`), the keywords with
            // optional arguments, we eagerly look for a semicolon or the
            // possibility to insert one.

            if (this.eat(Acorn.tokTypes.semi) || this.insertSemicolon()) {
                node.argument = null;
            } else {
                node.argument = this.parseExpression();
                this.semicolon();
            }
            return this.finishNode(node, 'ReturnStatement');
        };

        this._jsxFactory = options?.jsxFactory ?? 'h';
        this._jsxFragment = options?.jsxFragment ?? 'Fragment';
        this._importFactory = options?.importFactory ?? 'importModule';
        this._importMetaFactory = options?.importMetaFactory ?? 'importMeta';
        this._exportFactory = options?.exportFactory ?? 'exports';
        this._forceSync = options?.forceSync ?? false;
    }

    parse(code: string): any {
        const macroed = replaceMacros(code);
        const node = this._parse(macroed);
        return node;
    }

    /**
     * Transpiles the given code into ES6 JavaScript Code.
     */
    transpile(code: string): string {
        const result = this._transpile(code);
        return result.code;
    }

    /**
     * Transpiles the given code and returns the result with the generated metadata.
     * @param code The code that should be transpiled.
     */
    transpileWithMetadata(code: string): TranspilerResult {
        return this._transpile(code);
    }

    /**
     * Determines if the given node contains any await expressions.
     * @param node The node.
     */
    private _isAsyncNode(node: any): boolean {
        if (!node || asyncBoundaryNodes.has(node.type)) {
            return false;
        }

        if (node.type === 'AwaitExpression') {
            return true;
        }

        for (const key in node) {
            const child = node[key];
            if (!child || typeof child !== 'object' || key === 'parent') {
                continue;
            }

            if (Array.isArray(child)) {
                for (const item of child) {
                    if (this._isAsyncNode(item)) {
                        return true;
                    }
                }
            } else if (this._isAsyncNode(child)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Transpiles the given code into ES6 JavaScript Code.
     */
    private _transpile(code: string): TranspilerResult {
        const cached = this._cache.get(code);
        if (cached) {
            return cached;
        }
        const macroed = replaceMacros(code);
        const node = this._parse(macroed);
        const isAsync = this._isAsyncNode(node);

        // we create a YJS document to track
        // text changes. This lets us use a separate client ID for each change
        // which makes the calculations for indexes much simpler.
        // This is because we can use a separate client ID for every required
        // change and ignore other changes when looking for the right edit position.
        const doc = new Doc();
        doc.clientID = 0;

        const text = doc.getText();
        text.insert(0, code);

        let metadata: TranspilerResult['metadata'] = {
            doc,
            text,
            isAsync,
            isModule: false,
        };

        this._replace(node, doc, text, metadata);
        const finalCode = text.toString();
        const result: TranspilerResult = {
            code: finalCode,
            original: macroed,
            metadata,
        };
        this._cache.set(code, result);

        return result;
    }

    /**
     * Parses the given code into a syntax tree.
     * @param code
     */
    private _parse(code: string): any {
        const node = this._parser.parse(code, {
            ecmaVersion: <any>14,
            locations: true,
            sourceType: 'module',
        });
        return node;
    }

    getTagNodeValues(n: any) {
        let currentNode = n.identifier;
        let identifier: any;
        let args: any[] = [];
        let nodes: any[] = [];
        while (currentNode.type === 'MemberExpression') {
            currentNode = currentNode.object;
        }
        if (currentNode.type === 'CallExpression') {
            identifier = currentNode.callee;
            args = currentNode.arguments;
            currentNode = n.identifier;
            while (currentNode.type === 'MemberExpression') {
                nodes.unshift(currentNode);
                currentNode = currentNode.object;
            }
        } else {
            identifier = n.identifier;
        }
        let tag: string;
        if (identifier.type === 'MemberExpression') {
            tag = this.toJs(identifier);
        } else {
            tag = identifier.name || identifier.value;
        }
        return { tag, args, nodes };
    }

    toJs(node: Acorn.Node): string {
        return generate(<any>node, {
            generator: exJsGenerator,
        });
    }

    private _replace(
        node: Acorn.Node,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): void {
        if (!node) {
            return;
        }

        traverse(<any>node, {
            enter: <any>((n: any, parent: any) => {
                if (n.type === 'ImportDeclaration') {
                    this._replaceImportDeclaration(
                        n,
                        parent,
                        doc,
                        text,
                        metadata
                    );
                } else if (n.type === 'ImportExpression') {
                    this._replaceImportExpression(
                        n,
                        parent,
                        doc,
                        text,
                        metadata
                    );
                } else if (n.type === 'ExportNamedDeclaration') {
                    this._replaceExportNamedDeclaration(
                        n,
                        parent,
                        doc,
                        text,
                        metadata
                    );
                } else if (n.type === 'ExportDefaultDeclaration') {
                    this._replaceExportDefaultDeclaration(
                        n,
                        parent,
                        doc,
                        text,
                        metadata
                    );
                } else if (n.type === 'ExportAllDeclaration') {
                    this._replaceExportAllDeclaration(
                        n,
                        parent,
                        doc,
                        text,
                        metadata
                    );
                } else if (
                    n.type === 'MetaProperty' &&
                    n.meta.name === 'import' &&
                    n.property.name === 'meta'
                ) {
                    this._replaceImportMeta(n, parent, doc, text, metadata);
                } else if (n.type === 'WhileStatement') {
                    this._replaceWhileStatement(n, doc, text);
                } else if (n.type === 'DoWhileStatement') {
                    this._replaceDoWhileStatement(n, doc, text);
                } else if (n.type === 'ForStatement') {
                    this._replaceForStatement(n, doc, text);
                } else if (n.type === 'ForInStatement') {
                    this._replaceForInStatement(n, doc, text);
                } else if (n.type === 'ForOfStatement') {
                    this._replaceForOfStatement(n, doc, text);
                } else if (n.type === 'JSXElement') {
                    this._replaceJSXElement(n, doc, text, metadata);
                } else if (n.type === 'JSXText') {
                    this._replaceJSXText(n, doc, text);
                } else if (n.type === 'JSXExpressionContainer') {
                    this._replaceJSXExpressionContainer(n, doc, text);
                } else if (n.type === 'JSXFragment') {
                    this._replaceJSXFragment(n, doc, text, metadata);
                } else if (n.type === 'JSXEmptyExpression') {
                    this._replaceJSXEmptyExpression(n, doc, text);
                } else if (
                    this._forceSync &&
                    n.type === 'FunctionDeclaration' &&
                    n.async
                ) {
                    this._replaceAsyncFunction(n, doc, text);
                } else if (
                    this._forceSync &&
                    n.type === 'ArrowFunctionExpression' &&
                    n.async
                ) {
                    this._replaceAsyncFunction(n, doc, text);
                } else if (
                    this._forceSync &&
                    n.type === 'FunctionExpression' &&
                    n.async
                ) {
                    if (parent.type === 'Property' && parent.method) {
                        this._replaceAsyncFunction(parent, doc, text);
                    } else {
                        this._replaceAsyncFunction(n, doc, text);
                    }
                } else if (this._forceSync && n.type === 'AwaitExpression') {
                    this._replaceAwaitExpression(n, doc, text);
                } else if (
                    n.type === 'ClassDeclaration' ||
                    n.type === 'ClassExpression'
                ) {
                    if (n.implements?.length > 0) {
                        this._removeClassImplements(n, doc, text);
                    }

                    if (n.abstract === true) {
                        this._removeClassAbstract(n, doc, text);
                    }
                } else if (n.type === 'TSParameterProperty') {
                    // do nothing
                } else if (n.type === 'MethodDefinition') {
                    if (n.abstract) {
                        this._removeNodeOrReplaceWithUndefined(n, doc, text);
                    } else if (n.accessibility) {
                        this._removeAccessibility(n, doc, text);
                    }
                } else if (n.type === 'PropertyDefinition') {
                    if (n.accessibility) {
                        this._removeAccessibility(n, doc, text);
                    }
                } else if (n.type === 'TSAsExpression') {
                    this._removeAsExpression(n, doc, text);
                } else if (n.type === 'Identifier' && n.optional === true) {
                    this._removeOptionalFromIdentifier(n, doc, text);
                } else if (n.type.startsWith('TS')) {
                    this._removeNodeOrReplaceWithUndefined(n, doc, text);
                }
            }),

            keys: {
                JSXElement: [],
                JSXFragment: [],
                JSXOpeningElement: [],
                JSXClosingElement: [],
                JSXText: [],
                JSXExpressionContainer: ['expression'],
                JSXEmptyExpression: [],

                ...TypeScriptVisistorKeys,
            },
        });
    }

    private _replaceImportDeclaration(
        node: any,
        parent: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): any {
        metadata.isModule = true;

        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            undefined,
            true
        );
        const statementEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.source.end,
            1,
            true
        );
        const sourceStart = createRelativePositionFromStateVector(
            text,
            version,
            node.source.start,
            -1,
            true
        );

        const sourceEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.source.end,
            1,
            true
        );

        let currentIndex = absoluteStart.index;

        let importCall = node.specifiers.length > 0 ? `const ` : '';

        const namespaceImport = node.specifiers.find(
            (s: any) => s.type === 'ImportNamespaceSpecifier'
        );
        const defaultImport = node.specifiers.find(
            (s: any) => s.type === 'ImportDefaultSpecifier'
        );

        if (namespaceImport) {
            importCall += `${namespaceImport.local.name} = `;
        } else {
            let addedBraces = false;
            for (let specifier of node.specifiers) {
                if (specifier.type === 'ImportSpecifier') {
                    if (!addedBraces) {
                        addedBraces = true;
                        importCall += `{ `;
                    }
                    if (specifier.local === specifier.imported) {
                        importCall += `${specifier.local.name}, `;
                    } else {
                        importCall += `${specifier.imported.name}: ${specifier.local.name}, `;
                    }
                } else if (specifier.type === 'ImportDefaultSpecifier') {
                    if (!addedBraces) {
                        addedBraces = true;
                        importCall += `{ `;
                    }
                    importCall += `default: ${specifier.local.name}, `;
                }
            }

            if (addedBraces) {
                importCall += `}`;
            }
            if (node.specifiers.length > 0) {
                importCall += ` = `;
            }
        }

        if (node.importKind === 'type') {
            importCall += `{}`;
        } else {
            importCall += `await ${this._importFactory}(`;
        }
        text.insert(currentIndex, importCall);

        currentIndex += importCall.length;

        if (node.importKind !== 'type') {
            const absoluteSourceEnd =
                createAbsolutePositionFromRelativePosition(sourceEnd, doc);

            text.insert(
                absoluteSourceEnd.index,
                `, ${this._importMetaFactory})`
            );
            if (namespaceImport && defaultImport) {
                const absoluteEnd = createAbsolutePositionFromRelativePosition(
                    statementEnd,
                    doc
                );

                let defaultImportSource = `\nconst { default: ${defaultImport.local.name} } = ${namespaceImport.local.name};`;
                text.insert(absoluteEnd.index + 1, defaultImportSource);
            }

            const absoluteSourceStart =
                createAbsolutePositionFromRelativePosition(sourceStart, doc);

            text.delete(currentIndex, absoluteSourceStart.index - currentIndex);
        } else {
            const absoluteSourceEnd =
                createAbsolutePositionFromRelativePosition(sourceEnd, doc);

            text.delete(currentIndex, absoluteSourceEnd.index - currentIndex);
        }
    }

    private _replaceImportExpression(
        node: any,
        parent: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): any {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            undefined,
            true
        );
        const sourceStart = createRelativePositionFromStateVector(
            text,
            version,
            node.source.start,
            -1,
            true
        );

        const sourceEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.source.end,
            1,
            true
        );

        let currentIndex = absoluteStart.index;

        let importCall = `${this._importFactory}(`;

        text.insert(currentIndex, importCall);

        currentIndex += importCall.length;

        const absoluteSourceEnd = createAbsolutePositionFromRelativePosition(
            sourceEnd,
            doc
        );

        text.insert(absoluteSourceEnd.index, `, ${this._importMetaFactory}`);

        const absoluteSourceStart = createAbsolutePositionFromRelativePosition(
            sourceStart,
            doc
        );

        text.delete(currentIndex, absoluteSourceStart.index - currentIndex);
    }

    private _replaceImportMeta(
        node: any,
        parent: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): any {
        metadata.isModule = true;
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            undefined,
            true
        );
        const absoluteEnd = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.end,
            1,
            true
        );

        text.insert(absoluteEnd.index, `${this._importMetaFactory}`);
        text.delete(
            absoluteStart.index,
            absoluteEnd.index - absoluteStart.index
        );
    }

    private _replaceExportNamedDeclaration(
        node: any,
        parent: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): any {
        if (node.declaration) {
            this._replaceExportVariableDeclaration(
                node,
                parent,
                doc,
                text,
                metadata
            );
        } else if (node.source) {
            this._replaceExportFromSourceDeclaration(
                node,
                parent,
                doc,
                text,
                metadata
            );
        } else {
            this._replaceExportSpecifiersDeclaration(
                node,
                parent,
                doc,
                text,
                metadata
            );
        }
    }

    private _replaceExportVariableDeclaration(
        node: any,
        parent: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): void {
        metadata.isModule = true;

        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            undefined,
            true
        );
        const declarationStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.declaration.start,
            undefined,
            true
        );

        const declarationEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.declaration.end,
            -1,
            true
        );

        text.delete(
            absoluteStart.index,
            declarationStart.index - absoluteStart.index
        );

        const absoluteDeclarationEnd =
            createAbsolutePositionFromRelativePosition(declarationEnd, doc);

        let exportCall = `\nawait ${this._exportFactory}({ `;

        if (node.declaration.type === 'VariableDeclaration') {
            for (let declaration of node.declaration.declarations) {
                exportCall += `${declaration.id.name}, `;
            }
        } else {
            exportCall += `${node.declaration.id.name}, `;
        }

        exportCall += `});`;

        text.insert(absoluteDeclarationEnd.index, exportCall);
    }

    private _replaceExportSpecifiersDeclaration(
        node: any,
        parent: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): void {
        metadata.isModule = true;

        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            -1,
            true
        );

        const relativeEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.end,
            -1,
            true
        );

        if (node.specifiers.length > 0) {
            let exportCall = `await ${this._exportFactory}({ `;

            for (let specifier of node.specifiers) {
                if (specifier.local === specifier.exported) {
                    exportCall += `${specifier.local.name}, `;
                } else {
                    exportCall += `${specifier.exported.name}: ${specifier.local.name}, `;
                }
            }

            exportCall += `});`;

            let currentIndex = absoluteStart.index;
            text.insert(currentIndex, exportCall);

            currentIndex += exportCall.length;

            const absoluteEnd = createAbsolutePositionFromRelativePosition(
                relativeEnd,
                doc
            );

            text.delete(currentIndex, absoluteEnd.index - currentIndex);
        } else {
            let exportCall = `await ${this._exportFactory}({});`;
            let currentIndex = absoluteStart.index;
            text.insert(currentIndex, exportCall);

            currentIndex += exportCall.length;

            const absoluteEnd = createAbsolutePositionFromRelativePosition(
                relativeEnd,
                doc
            );

            text.delete(currentIndex, absoluteEnd.index - currentIndex);
        }
    }

    private _replaceExportFromSourceDeclaration(
        node: any,
        parent: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): void {
        metadata.isModule = true;

        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            undefined,
            true
        );

        const relativeSourceStart = createRelativePositionFromStateVector(
            text,
            version,
            node.source.start,
            -1,
            true
        );

        const relativeSourceEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.source.end,
            -1,
            true
        );

        const relativeEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.end,
            -1,
            true
        );

        if (node.specifiers.length > 0) {
            let exportCall = `await ${this._exportFactory}(`;

            let specifiers = ', [';
            for (let specifier of node.specifiers) {
                if (specifier.local === specifier.exported) {
                    specifiers += `'${specifier.local.name}', `;
                } else {
                    specifiers += `['${specifier.local.name}', '${specifier.exported.name}'], `;
                }
            }

            specifiers += ']);';

            let currentIndex = absoluteStart.index;
            text.insert(currentIndex, exportCall);
            currentIndex += exportCall.length;

            const sourceEnd = createAbsolutePositionFromRelativePosition(
                relativeSourceEnd,
                doc
            );

            text.insert(sourceEnd.index, specifiers);

            const sourceStart = createAbsolutePositionFromRelativePosition(
                relativeSourceStart,
                doc
            );

            text.delete(currentIndex, sourceStart.index - currentIndex);

            const absoluteEnd = createAbsolutePositionFromRelativePosition(
                relativeEnd,
                doc
            );
            const finalSourceEnd = createAbsolutePositionFromRelativePosition(
                relativeSourceEnd,
                doc
            );

            text.delete(
                absoluteEnd.index - 1,
                absoluteEnd.index - finalSourceEnd.index
            );
        } else {
            let exportCall = `await ${this._exportFactory}({});`;
            let currentIndex = absoluteStart.index;
            text.insert(currentIndex, exportCall);

            currentIndex += exportCall.length;

            const absoluteEnd = createAbsolutePositionFromRelativePosition(
                relativeEnd,
                doc
            );

            text.delete(currentIndex, absoluteEnd.index - currentIndex);
        }
    }

    private _replaceExportDefaultDeclaration(
        node: any,
        parent: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): void {
        metadata.isModule = true;

        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            undefined,
            true
        );

        const declarationStart = createRelativePositionFromStateVector(
            text,
            version,
            node.declaration.start,
            -1,
            true
        );

        const declarationEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.declaration.end,
            -1,
            true
        );

        const relativeEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.end,
            -1,
            true
        );

        let exportCall = `await ${this._exportFactory}({ default: `;
        let currentIndex = absoluteStart.index;
        text.insert(currentIndex, exportCall);

        currentIndex += exportCall.length;

        const absoluteDeclarationStart =
            createAbsolutePositionFromRelativePosition(declarationStart, doc);

        text.delete(
            currentIndex,
            absoluteDeclarationStart.index - currentIndex
        );

        const absoluteDeclarationEnd =
            createAbsolutePositionFromRelativePosition(declarationEnd, doc);

        text.insert(absoluteDeclarationEnd.index, ' });');

        const absoulteEnd = createAbsolutePositionFromRelativePosition(
            relativeEnd,
            doc
        );

        text.delete(absoulteEnd.index - 1, 1);
    }

    private _replaceExportAllDeclaration(
        node: any,
        parent: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): void {
        metadata.isModule = true;

        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            undefined,
            true
        );

        const sourceStart = createRelativePositionFromStateVector(
            text,
            version,
            node.source.start,
            -1,
            true
        );

        const sourceEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.source.end,
            -1,
            true
        );

        const relativeEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.end,
            -1,
            true
        );

        let exportCall = `await ${this._exportFactory}(`;
        let currentIndex = absoluteStart.index;
        text.insert(currentIndex, exportCall);

        currentIndex += exportCall.length;

        const absolutesourceStart = createAbsolutePositionFromRelativePosition(
            sourceStart,
            doc
        );

        text.delete(currentIndex, absolutesourceStart.index - currentIndex);

        const absoluteSourceEnd = createAbsolutePositionFromRelativePosition(
            sourceEnd,
            doc
        );

        text.insert(absoluteSourceEnd.index, ');');

        const absoulteEnd = createAbsolutePositionFromRelativePosition(
            relativeEnd,
            doc
        );

        text.delete(absoulteEnd.index - 1, 1);
    }

    private _replaceWhileStatement(node: any, doc: Doc, text: Text): any {
        this._insertEnergyCheckIntoStatement(doc, text, node.body);
    }

    private _replaceDoWhileStatement(node: any, doc: Doc, text: Text): any {
        this._insertEnergyCheckIntoStatement(doc, text, node.body);
    }

    private _replaceForStatement(node: any, doc: Doc, text: Text): any {
        this._insertEnergyCheckIntoStatement(doc, text, node.body);
    }

    private _replaceForInStatement(node: any, doc: Doc, text: Text): any {
        this._insertEnergyCheckIntoStatement(doc, text, node.body);
    }

    private _replaceForOfStatement(node: any, doc: Doc, text: Text): any {
        this._insertEnergyCheckIntoStatement(doc, text, node.body);
    }

    private _removeClassImplements(node: any, doc: Doc, text: Text): any {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const firstImplemented = node.implements[0];
        const lastImplemented = node.implements[node.implements.length - 1];

        const implementedStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            firstImplemented.start - 'implements '.length,
            undefined,
            true
        );

        const implementedEnd = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            lastImplemented.end,
            -1,
            true
        );

        text.delete(
            implementedStart.index,
            implementedEnd.index - implementedStart.index
        );
    }

    private _removeClassAbstract(node: any, doc: Doc, text: Text): any {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const abstractStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            undefined,
            true
        );

        const abstractEnd = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start + 'abstract '.length,
            -1,
            true
        );

        text.delete(
            abstractStart.index,
            abstractEnd.index - abstractStart.index
        );
    }

    private _removeAccessibility(node: any, doc: Doc, text: Text): any {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const accessibility: string = node.accessibility + ' ';
        const t = text.toString();

        const relativeStart = createRelativePositionFromStateVector(
            text,
            version,
            node.start,
            -1,
            true
        );
        const absoluteStart = createAbsolutePositionFromRelativePosition(
            relativeStart,
            doc
        );

        const indexOfAccessibility = t.indexOf(
            accessibility,
            absoluteStart.index
        );

        if (indexOfAccessibility < 0 || indexOfAccessibility > node.key.start) {
            return;
        }

        text.delete(indexOfAccessibility, accessibility.length);
    }

    private _removeAsExpression(node: any, doc: Doc, text: Text): any {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const expressionEnd = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.expression.end,
            -1,
            true
        );

        const absoluteEnd = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.end,
            -1,
            true
        );

        text.delete(
            expressionEnd.index,
            absoluteEnd.index - expressionEnd.index
        );
    }

    private _removeNodeOrReplaceWithUndefined(
        node: any,
        doc: Doc,
        text: Text
    ): any {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        if (
            node.type === 'TSInterfaceDeclaration' ||
            node.type === 'TSCallSignatureDeclaration' ||
            node.type === 'TSEnumDeclaration' ||
            node.type === 'TSTypeAliasDeclaration'
        ) {
            // replace with const Identifier = void 0; instead of deleting
            // This is because these declarations might be referenced in a later export {} declaration,
            // so we need to keep the identifier around.
            // In the future, we might optimize this to also delete TypeScript-sepecific declarations from those exports.

            const absoluteStart = createAbsolutePositionFromStateVector(
                doc,
                text,
                version,
                node.start,
                undefined,
                true
            );

            const identifierStart = createRelativePositionFromStateVector(
                text,
                version,
                node.id.start,
                undefined,
                true
            );

            const identifierEnd = createRelativePositionFromStateVector(
                text,
                version,
                node.id.end,
                -1,
                true
            );

            const end = createRelativePositionFromStateVector(
                text,
                version,
                node.end,
                -1,
                true
            );

            const absoluteIdentifierStart =
                createAbsolutePositionFromRelativePosition(
                    identifierStart,
                    doc
                );

            text.insert(absoluteIdentifierStart.index, 'const ');
            text.delete(
                absoluteStart.index,
                absoluteIdentifierStart.index - absoluteStart.index
            );

            const absoluteIdentifierEnd =
                createAbsolutePositionFromRelativePosition(identifierEnd, doc);

            let str = ` = void 0;`;
            text.insert(absoluteIdentifierEnd.index, str);

            const absoluteEnd = createAbsolutePositionFromRelativePosition(
                end,
                doc
            );

            text.delete(
                absoluteIdentifierEnd.index + str.length,
                absoluteEnd.index - absoluteIdentifierEnd.index - str.length
            );

            return;
        }

        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            undefined,
            true
        );
        const absoluteEnd = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.end,
            -1,
            true
        );

        text.delete(
            absoluteStart.index,
            absoluteEnd.index - absoluteStart.index
        );
    }

    private _removeOptionalFromIdentifier(
        node: any,
        doc: Doc,
        text: Text
    ): any {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const absoluteEnd = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.typeAnnotation?.start ?? node.end,
            -1,
            true
        );

        text.delete(absoluteEnd.index - 1, 1);
    }

    private _replaceJSXElement(
        node: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): any {
        this._insertJSXFactoryCall(
            node,
            node.openingElement,
            node.closingElement,
            doc,
            text,
            metadata
        );

        this._removeTag(
            node,
            node.openingElement,
            node.closingElement,
            doc,
            text
        );
    }

    private _replaceJSXFragment(
        node: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): any {
        this._insertJSXFactoryCall(
            node,
            node.openingFragment,
            node.closingFragment,
            doc,
            text,
            metadata
        );

        this._removeTag(
            node,
            node.openingFragment,
            node.closingFragment,
            doc,
            text
        );
    }

    private _replaceJSXEmptyExpression(node: any, doc: Doc, text: Text): any {
        const version = { '0': getClock(doc, 0) };

        // Position for the opening "{"
        const valueStartBegin = createRelativePositionFromStateVector(
            text,
            version,
            node.start,
            undefined,
            true
        );

        // Position for the closing "}"
        const valueEndEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.end + 1,
            -1,
            true
        );

        // Delete the expression
        const absoluteValueStartBegin =
            createAbsolutePositionFromRelativePosition(valueStartBegin, doc);
        const absoluteValueEndEnd = createAbsolutePositionFromRelativePosition(
            valueEndEnd,
            doc
        );
        const length =
            absoluteValueEndEnd.index - absoluteValueStartBegin.index;
        text.delete(absoluteValueStartBegin.index, length);
        text.insert(absoluteValueStartBegin.index, "''");
    }

    private _insertJSXFactoryCall(
        node: any,
        openElement: any,
        closeElement: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): void {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        let openingFunctionCall = `${this._jsxFactory}(`;
        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            node.start,
            undefined,
            true
        );
        const end = createRelativePositionFromStateVector(
            text,
            version,
            !!closeElement ? closeElement.end : node.end,
            -1,
            true
        );
        const nameStart =
            node.type === 'JSXElement'
                ? createRelativePositionFromStateVector(
                      text,
                      version,
                      openElement.name.start,
                      undefined,
                      true
                  )
                : null;
        const nameEnd =
            node.type == 'JSXElement'
                ? createRelativePositionFromStateVector(
                      text,
                      version,
                      openElement.name.end,
                      -1,
                      true
                  )
                : null;

        let currentIndex = absoluteStart.index;

        if (node.start > 0) {
            const prevChar = getTextChar(text, currentIndex - 1);
            // Add space if previous character is not a whitespace or an opening bracket
            if (/[^\s()[\]<>\n\r=\\/,]/g.test(prevChar)) {
                openingFunctionCall = ` ${openingFunctionCall}`;
            }
        }
        text.insert(currentIndex, openingFunctionCall);
        currentIndex += openingFunctionCall.length;

        if (node.type === 'JSXElement') {
            const nameElement = openElement.name;

            let addQuotes = false;
            if (nameElement.type === 'JSXIdentifier') {
                const name = openElement.name.name;
                if (/^[a-z]/.test(name)) {
                    addQuotes = true;
                }
            }

            // Add quotes around builtin component names
            if (addQuotes) {
                const startIndex = createAbsolutePositionFromRelativePosition(
                    nameStart,
                    doc
                );
                text.insert(startIndex.index, '"');
                const endIndex = createAbsolutePositionFromRelativePosition(
                    nameEnd,
                    doc
                );
                text.insert(endIndex.index, '",');
                currentIndex = endIndex.index + 2;
            } else {
                // Add the comma after variable reference names
                const endIndex = createAbsolutePositionFromRelativePosition(
                    nameEnd,
                    doc
                );
                text.insert(endIndex.index, ',');
                currentIndex = endIndex.index + 1;
            }
        } else {
            // make string literal
            const nodeName = this._jsxFragment + ',';
            text.insert(currentIndex, nodeName);
            currentIndex += nodeName.length;
        }

        if (openElement.attributes.length > 0) {
            this._replaceJSXElementAttributes(
                node,
                openElement,
                openElement.attributes,
                doc,
                text,
                metadata
            );
        } else {
            const props = `null,`;
            text.insert(currentIndex, props);
        }

        this._replaceJSXElementChildren(
            node,
            node.children,
            doc,
            text,
            metadata
        );

        const absoluteEnd = createAbsolutePositionFromRelativePosition(
            end,
            doc
        );
        doc.clientID += 1;
        text.insert(absoluteEnd.index, ')');
    }

    private _replaceJSXElementAttributes(
        node: any,
        openElement: any,
        attributes: any[],
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): void {
        // doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const start = createRelativePositionFromStateVector(
            text,
            version,
            openElement.name?.end ?? openElement.start + 1,
            undefined,
            true
        );
        const end = createRelativePositionFromStateVector(
            text,
            version,
            openElement.selfClosing ? openElement.end - 2 : openElement.end,
            -1,
            true
        );

        let attrs = [];

        for (let attr of attributes) {
            const attrStart = createRelativePositionFromStateVector(
                text,
                version,
                attr.start,
                undefined,
                true
            );

            if (attr.type === 'JSXSpreadAttribute') {
                attrs.push([attr, attrStart]);
            } else {
                const attrName = attr.name.name;
                attrs.push([attr, attrStart, attrName]);
            }
        }

        let index = 0;
        for (let [attr, start, name] of attrs) {
            const pos = createAbsolutePositionFromRelativePosition(start, doc);
            let val = '';
            if (index > 0) {
                val = ',';
            }
            if (attr.type !== 'JSXSpreadAttribute') {
                val += `"${name}":`;

                if (!attr.value) {
                    val += 'true';
                }
            }
            text.insert(pos.index, val);
            index++;

            if (attr.type === 'JSXSpreadAttribute') {
                this._replace(attr.argument, doc, text, metadata);
            } else {
                this._replace(attr.value, doc, text, metadata);
            }
        }

        const startAbsolute = createAbsolutePositionFromRelativePosition(
            start,
            doc
        );
        text.insert(startAbsolute.index, '{');

        const endAbsolute = createAbsolutePositionFromRelativePosition(
            end,
            doc
        );
        text.insert(endAbsolute.index, '},');
    }

    private _replaceJSXElementChildren(
        node: any,
        children: any,
        doc: Doc,
        text: Text,
        metadata: TranspilerResult['metadata']
    ): void {
        const version = { '0': getClock(doc, 0) };

        for (let child of children) {
            const pos = createRelativePositionFromStateVector(
                text,
                version,
                child.end,
                undefined,
                true
            );
            this._replace(child, doc, text, metadata);

            doc.clientID += 1;
            const absoluteEnd = createAbsolutePositionFromRelativePosition(
                pos,
                doc
            );
            text.insert(absoluteEnd.index, ',');
        }
    }

    private _replaceJSXText(node: any, doc: Doc, text: Text): any {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const startIndex = node.start;
        const endIndex = node.end;

        const absoluteStart = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            startIndex,
            undefined,
            true
        );
        text.insert(absoluteStart.index, '`');

        const absoluteEnd = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            endIndex,
            undefined,
            true
        );
        text.insert(absoluteEnd.index, '`');
    }

    private _replaceJSXExpressionContainer(node: any, doc: Doc, text: Text) {
        const version = { '0': getClock(doc, 0) };

        // Positions for the opening "{"
        const valueStartBegin = createRelativePositionFromStateVector(
            text,
            version,
            node.start,
            undefined,
            true
        );
        const valueStartEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.start + 1,
            -1,
            true
        );

        // Positions for the closing "}"
        const valueEndBegin = createRelativePositionFromStateVector(
            text,
            version,
            node.end - 1,
            undefined,
            true
        );
        const valueEndEnd = createRelativePositionFromStateVector(
            text,
            version,
            node.end + 1,
            -1,
            true
        );

        // Delete the opening "{"
        const absoluteValueStartBegin =
            createAbsolutePositionFromRelativePosition(valueStartBegin, doc);
        const absoluteValueStartEnd =
            createAbsolutePositionFromRelativePosition(valueStartEnd, doc);
        text.delete(absoluteValueStartBegin.index, 1);

        // Delete the closing "}"
        const absoluteValueEndBegin =
            createAbsolutePositionFromRelativePosition(valueEndBegin, doc);
        const absoluteValueEndEnd = createAbsolutePositionFromRelativePosition(
            valueEndEnd,
            doc
        );
        text.delete(absoluteValueEndBegin.index, 1);
    }

    private _removeTag(
        node: any,
        openElement: any,
        closeElement: any,
        doc: Doc,
        text: Text
    ): void {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        // Save relative positions here
        const openStart = createRelativePositionFromStateVector(
            text,
            version,
            openElement.start,
            undefined,
            true
        );
        const openNameEnd = createRelativePositionFromStateVector(
            text,
            version,
            openElement.name?.end ?? openElement.start + 1,
            -1,
            true
        );
        const openEnd = createRelativePositionFromStateVector(
            text,
            version,
            openElement.end - (closeElement ? 1 : 2),
            undefined,
            true
        );
        const closingStart = !!closeElement
            ? createRelativePositionFromStateVector(
                  text,
                  version,
                  closeElement.start,
                  undefined,
                  true
              )
            : null;
        const closingEnd = !!closeElement
            ? createRelativePositionFromStateVector(
                  text,
                  version,
                  closeElement.end,
                  -1,
                  true
              )
            : null;

        let attributePositions = [];
        for (let attribute of openElement.attributes) {
            if (attribute.type !== 'JSXSpreadAttribute') {
                const nameStart = createRelativePositionFromStateVector(
                    text,
                    version,
                    attribute.name.start,
                    undefined,
                    true
                );
                const nameEnd = createRelativePositionFromStateVector(
                    text,
                    version,
                    !!attribute.value
                        ? attribute.name.end + 1
                        : attribute.name.end,
                    -1,
                    true
                );

                attributePositions.push([nameStart, nameEnd]);
            } else {
                const openBraceStart = createRelativePositionFromStateVector(
                    text,
                    version,
                    attribute.start,
                    undefined,
                    true
                );
                const openBraceEnd = createRelativePositionFromStateVector(
                    text,
                    version,
                    attribute.start + 1,
                    undefined,
                    true
                );
                const closeBraceStart = createRelativePositionFromStateVector(
                    text,
                    version,
                    attribute.end - 1,
                    -1,
                    true
                );
                const closeBraceEnd = createRelativePositionFromStateVector(
                    text,
                    version,
                    attribute.end,
                    -1,
                    true
                );

                attributePositions.push([openBraceStart, openBraceEnd]);
                attributePositions.push([closeBraceStart, closeBraceEnd]);
            }
        }

        for (let [start, end] of attributePositions) {
            // remove attribute name
            const nameStart = createAbsolutePositionFromRelativePosition(
                start,
                doc
            );
            const nameEnd = createAbsolutePositionFromRelativePosition(
                end,
                doc
            );

            // remove name + "="
            text.delete(nameStart.index, nameEnd.index - nameStart.index);
        }

        // remove open tag <
        const openStartAbsolute = createAbsolutePositionFromRelativePosition(
            openStart,
            doc
        );
        text.delete(openStartAbsolute.index, 1);

        // remove open tag >
        const openEndAbsolute = createAbsolutePositionFromRelativePosition(
            openEnd,
            doc
        );
        text.delete(openEndAbsolute.index, closeElement ? 1 : 2);

        if (closeElement) {
            // remove closing tag
            const closingStartAbsolute =
                createAbsolutePositionFromRelativePosition(closingStart, doc);
            const closingEndAbsolute =
                createAbsolutePositionFromRelativePosition(closingEnd, doc);
            text.delete(
                closingStartAbsolute.index,
                closingEndAbsolute.index - closingStartAbsolute.index
            );
        }
    }

    private _insertEnergyCheckIntoStatement(
        doc: Doc,
        text: Text,
        statement: any
    ) {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };
        let startIndex: number;
        let postfix: string = '';
        let wrapWithBraces: boolean = false;

        if (statement.type === 'BlockStatement') {
            // Block statements look like this:
            // while(true) { }
            // Block statements are wrapped with curly braces
            // so we should use a full statement "__energyCheck();"
            startIndex = statement.start + 1;
            postfix = ';';
        } else if (statement.type === 'ExpressionStatement') {
            // Expression statements look like this:
            // while(true) abc();
            // therefore, we can find the start of the expression and use a comma
            // between our call and the other code to make it a sequence expression.
            startIndex = statement.start;
            postfix = ';';
            wrapWithBraces = true;
        } else if (statement.type === 'EmptyStatement') {
            // Empty statements look like this:
            // while(true) ;
            // as a result, we only need to insert the call to convert the expression from empty to
            // an expression statement containing a single function call.
            startIndex = statement.start;
        } else {
            // Other statements (like "if", "try", "throw" and other loops)
            // should be wrapped in curly braces
            startIndex = statement.start;
            postfix = ';';
            wrapWithBraces = true;
        }

        this._insertEnergyCheck(
            doc,
            text,
            version,
            startIndex,
            statement.end,
            postfix,
            wrapWithBraces
        );
    }

    private _insertEnergyCheck(
        doc: Doc,
        text: Text,
        version: VersionVector,
        startIndex: number,
        endIndex: number,
        postfix: string,
        wrapWithBraces: boolean
    ) {
        if (wrapWithBraces) {
            const absolute = createAbsolutePositionFromStateVector(
                doc,
                text,
                version,
                startIndex,
                undefined,
                true
            );
            text.insert(absolute.index, '{');
        }

        const absolute = createAbsolutePositionFromStateVector(
            doc,
            text,
            version,
            startIndex,
            undefined,
            true
        );
        text.insert(absolute.index, ENERGY_CHECK_CALL + postfix);

        if (wrapWithBraces) {
            const absolute = createAbsolutePositionFromStateVector(
                doc,
                text,
                version,
                endIndex,
                undefined,
                true
            );
            text.insert(absolute.index, '}');
        }
    }

    private _replaceAsyncFunction(node: any, doc: Doc, text: Text) {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const functionStart = createRelativePositionFromStateVector(
            text,
            version,
            node.start,
            undefined,
            true
        );
        const functionStartAbsolute =
            createAbsolutePositionFromRelativePosition(functionStart, doc);

        text.delete(functionStartAbsolute.index, 'async '.length);
    }

    private _replaceAwaitExpression(node: any, doc: Doc, text: Text) {
        doc.clientID += 1;
        const version = { '0': getClock(doc, 0) };

        const keywordStart = createRelativePositionFromStateVector(
            text,
            version,
            node.start,
            undefined,
            true
        );
        const keywordStartAbsolute = createAbsolutePositionFromRelativePosition(
            keywordStart,
            doc
        );

        text.delete(keywordStartAbsolute.index, 'await '.length);
    }
}

const ENERGY_CHECK_CALL = '__energyCheck()';

export interface TranspilerResult {
    /**
     * The code that resulted from the transpiler.
     */
    code: string;

    /**
     * The original code.
     */
    original: string;

    /**
     * The metadata that the transpiler produced for the code.
     */
    metadata: {
        /**
         * The document that was used to edit the code.
         */
        doc: Doc;

        /**
         * The text structure that was used to edit the code.
         */
        text: Text;

        /**
         * Whether the code is a module (contains import or export statements).
         */
        isModule: boolean;

        /**
         * Whether the code is async (contains await expressions).
         */
        isAsync: boolean;
    };
}

/**
 * Calculates the original location that the given line and column numbers occurred at in the given transpiler result.
 * @param result The transpiler result.
 * @param location The location that should be converted from the transpiler output space to the transpiler input space.
 */
export function calculateOriginalLineLocation(
    result: TranspilerResult,
    location: CodeLocation
): CodeLocation {
    const index = calculateIndexFromLocation(result.code, location);

    const relative = createRelativePositionFromTypeIndex(
        result.metadata.text,
        index
    );

    if (relative.item.client === 0) {
        return calculateLocationFromIndex(result.original, relative.item.clock);
    }

    let item = getItem(result.metadata.doc.store, relative.item);

    while (item && item.id.client !== 0) {
        item = item.left;
    }

    return calculateLocationFromIndex(
        result.original,
        item.id.clock + item.length
    );
}

/**
 * Calculates the final location that the given line and column numbers occurr at in the given transpiler result.
 * @param result The transpiler result.
 * @param location The location that should be converted from the transpiler input space to the output space.
 */
export function calculateFinalLineLocation(
    result: TranspilerResult,
    location: CodeLocation
): CodeLocation {
    const originalVersion = { '0': getClock(result.metadata.doc, 0) };
    const originalIndex = calculateIndexFromLocation(result.original, location);

    const relative = createRelativePositionFromStateVector(
        result.metadata.text,
        originalVersion,
        originalIndex
    );

    const absolute = createAbsolutePositionFromRelativePosition(
        relative,
        result.metadata.doc
    );

    return calculateLocationFromIndex(result.code, absolute.index);
}
