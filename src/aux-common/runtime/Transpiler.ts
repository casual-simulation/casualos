import * as Acorn from 'acorn';
import { generate, baseGenerator } from 'astring';
import LRU from 'lru-cache';
import { traverse } from 'estraverse';
import {
    createAbsolutePositionFromRelativePosition,
    createRelativePositionFromTypeIndex,
    getItem,
    Doc,
    Text,
} from 'yjs';
import {
    createRelativePositionFromStateVector,
    getClock,
} from '../yjs/YjsHelpers';
import { VersionVector } from '@casual-simulation/causal-trees';

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

const exJsGenerator = Object.assign({}, baseGenerator, {
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
 * The list of macros that the sandbox uses on the input code before transpiling it.
 */
const MACROS: TranspilerMacro[] = [
    {
        test: /^(?:\🧬)/g,
        replacement: (val) => '',
    },
    {
        test: /(?:[“”])/g,
        replacement: (val) => '"',
    },
    {
        test: /(?:[‘’])/g,
        replacement: (val) => "'",
    },
];

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

/**
 * Defines a class that is able to compile code from AUX's custom JavaScript dialect
 * into pure ES6 JavaScript. Does not preserve spacing or comments.
 *
 * See https://docs.google.com/document/d/1WQXQPjdXxyx_lau15WPpwTTYvt66_wPCu3x-08rpLoY/edit?usp=sharing
 */
export class Transpiler {
    private _parser: typeof Acorn.Parser;
    private _cache: LRU.Cache<string, TranspilerResult>;

    constructor() {
        this._cache = new LRU<string, TranspilerResult>({
            max: 1000,
        });
        this._parser = Acorn.Parser;
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
     * Transpiles the given code into ES6 JavaScript Code.
     */
    private _transpile(code: string): TranspilerResult {
        const cached = this._cache.get(code);
        if (cached) {
            return cached;
        }
        const macroed = replaceMacros(code);
        const node = this._parse(macroed);

        // we create a YJS document to track
        // text changes. This lets us use a separate client ID for each change
        // which makes the calculations for indexes much simpler.
        // This is because we can use a separate client ID for every required
        // change and ignore other changes when looking for the right edit position.
        const doc = new Doc();
        doc.clientID = 0;

        const text = doc.getText();
        text.insert(0, code);

        this._replace(macroed, node, doc, text);
        const finalCode = text.toString();
        const result: TranspilerResult = {
            code: finalCode,
            original: macroed,
            metadata: {
                doc,
                text,
            },
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
            ecmaVersion: <any>11,
            locations: true,
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
        code: string,
        node: Acorn.Node,
        doc: Doc,
        text: Text
    ): void {
        if (!node) {
            return;
        }

        traverse(<any>node, {
            enter: <any>((n: any, parent: any) => {
                if (n.type === 'WhileStatement') {
                    this._replaceWhileStatement(n, doc, text);
                } else if (n.type === 'DoWhileStatement') {
                    this._replaceDoWhileStatement(n, doc, text);
                } else if (n.type === 'ForStatement') {
                    this._replaceForStatement(n, doc, text);
                } else if (n.type === 'ForInStatement') {
                    this._replaceForInStatement(n, doc, text);
                } else if (n.type === 'ForOfStatement') {
                    this._replaceForOfStatement(n, doc, text);
                }
            }),
        });
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
            const relative = createRelativePositionFromStateVector(
                text,
                version,
                startIndex
            );
            const absolute = createAbsolutePositionFromRelativePosition(
                relative,
                doc
            );
            text.insert(absolute.index, '{');
        }

        const relative = createRelativePositionFromStateVector(
            text,
            version,
            startIndex
        );
        const absolute = createAbsolutePositionFromRelativePosition(
            relative,
            doc
        );
        text.insert(absolute.index, ENERGY_CHECK_CALL + postfix);

        if (wrapWithBraces) {
            const relative = createRelativePositionFromStateVector(
                text,
                version,
                endIndex
            );
            const absolute = createAbsolutePositionFromRelativePosition(
                relative,
                doc
            );
            text.insert(absolute.index, '}');
        }
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
    };
}

/**
 * Defines an interface that represents a location in some code by line number and column.
 */
export interface CodeLocation {
    /**
     * The zero based line number that the location represents.
     */
    lineNumber: number;

    /**
     * The zero based column number that the location represents.
     */
    column: number;
}

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

export function calculateIndexFromLocation(
    code: string,
    location: CodeLocation
): number {
    let line = location.lineNumber;
    let column = location.column;
    let index = 0;
    for (; index < code.length; index++) {
        const char = code[index];
        if (line > 0) {
            if (char === '\n') {
                line -= 1;
            }
        } else {
            index += column;
            break;
        }
    }

    return index;
}

export function calculateLocationFromIndex(
    code: string,
    index: number
): CodeLocation {
    let line = 0;
    let lastLineIndex = 0;
    for (let counter = 0; counter < code.length && counter < index; counter++) {
        const char = code[counter];
        if (char === '\n') {
            line += 1;
            lastLineIndex = counter + 1;
        }
    }

    let column = index - lastLineIndex;

    return {
        lineNumber: line,
        column,
    };
}
