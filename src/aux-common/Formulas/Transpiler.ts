import * as Acorn from 'acorn';
import { generate, baseGenerator } from 'astring';
import { replace, traverse, VisitorOption } from 'estraverse';
import { assign } from 'lodash';
import LRU from 'lru-cache';
import { takeLast } from 'rxjs/operators';

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

const exJsGenerator = assign({}, baseGenerator, {});

export interface TranspilerMacro {
    test: RegExp;
    replacement: (val: string) => string;
}

/**
 * Defines a class that is able to compile code from AUX's custom JavaScript dialect
 * into pure ES6 JavaScript. Does not preserve spacing or comments.
 *
 * See https://docs.google.com/document/d/1WQXQPjdXxyx_lau15WPpwTTYvt66_wPCu3x-08rpLoY/edit?usp=sharing
 */
export class Transpiler {
    private _parser: typeof Acorn.Parser;
    private _cache: LRU.Cache<string, string>;

    /**
     * The list of macros that the sandbox uses on the input code before transpiling it.
     */
    macros: TranspilerMacro[] = [
        {
            test: /^(?:\=|\:\=)/g,
            replacement: val => '',
        },
        {
            test: /(?:[“”])/g,
            replacement: val => '"',
        },
        {
            test: /(?:[‘’])/g,
            replacement: val => "'",
        },
    ];

    constructor() {
        this._cache = new LRU<string, string>({
            max: 1000,
        });
        this._parser = Acorn.Parser;
    }

    /**
     * Transpiles the given code into ES6 JavaScript Code.
     */
    transpile(code: string): string {
        const cached = this._cache.get(code);
        if (cached) {
            return cached;
        }
        const macroed = this._replaceMacros(code);
        this._cache.set(code, macroed);
        return macroed;
    }

    /**
     * Parses the given code into a syntax tree.
     * @param code
     */
    parse(code: string): any {
        const macroed = this._replaceMacros(code);
        const node = this._parser.parse(macroed);
        return node;
    }

    /**
     * Adds the given macro to the list of macros that are run on the code
     * before execution.
     */
    addMacro(macro: TranspilerMacro) {
        this.macros.push(macro);
    }

    private _replaceMacros(formula: string) {
        if (!formula) {
            return formula;
        }
        this.macros.forEach(m => {
            formula = formula.replace(m.test, m.replacement);
        });

        return formula;
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
}
