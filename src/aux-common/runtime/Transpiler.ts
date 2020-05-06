import * as Acorn from 'acorn';
import { generate, baseGenerator } from 'astring';
import LRU from 'lru-cache';
import { replace } from 'estraverse';

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

const exJsGenerator = Object.assign({}, baseGenerator, {});

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
        const node = this.parse(code);
        const replaced = this._replace(node);
        const final = this.toJs(replaced);
        this._cache.set(code, final);
        return final;
    }

    /**
     * Parses the given code into a syntax tree.
     * @param code
     */
    parse(code: string): any {
        const macroed = this.replaceMacros(code);
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

    private _replace(node: Acorn.Node): any {
        if (!node) {
            return node;
        }
        return <any>replace(<any>node, {
            enter: <any>((n: any, parent: any) => {
                if (n.type === 'WhileStatement') {
                    return this._replaceWhileStatement(n);
                } else if (n.type === 'DoWhileStatement') {
                    return this._replaceDoWhileStatement(n);
                } else if (n.type === 'ForStatement') {
                    return this._replaceForStatement(n);
                } else if (n.type === 'ForInStatement') {
                    return this._replaceForInStatement(n);
                } else if (n.type === 'ForOfStatement') {
                    return this._replaceForOfStatement(n);
                }
            }),
        });
    }

    private _replaceWhileStatement(node: any): any {
        let replacedBody = node.body;

        let existingStatements: any[] = [];
        if (replacedBody.type === 'BlockStatement') {
            existingStatements = replacedBody.body;
        } else {
            existingStatements = [replacedBody];
        }

        return {
            type: 'WhileStatement',
            test: node.test,
            body: {
                type: 'BlockStatement',
                body: [this._energyCheckCall(), ...existingStatements],
            },
        };
    }

    private _replaceDoWhileStatement(node: any): any {
        let replacedBody = node.body;

        let existingStatements: any[] = [];
        if (replacedBody.type === 'BlockStatement') {
            existingStatements = replacedBody.body;
        } else {
            existingStatements = [replacedBody];
        }

        return {
            type: 'DoWhileStatement',
            test: node.test,
            body: {
                type: 'BlockStatement',
                body: [this._energyCheckCall(), ...existingStatements],
            },
        };
    }

    private _replaceForStatement(node: any): any {
        let replacedBody = node.body;

        let existingStatements: any[] = [];
        if (replacedBody.type === 'BlockStatement') {
            existingStatements = replacedBody.body;
        } else {
            existingStatements = [replacedBody];
        }

        return {
            type: 'ForStatement',
            init: node.init,
            test: node.test,
            update: node.update,
            body: {
                type: 'BlockStatement',
                body: [this._energyCheckCall(), ...existingStatements],
            },
        };
    }

    private _replaceForInStatement(node: any): any {
        let replacedBody = node.body;

        let existingStatements: any[] = [];
        if (replacedBody.type === 'BlockStatement') {
            existingStatements = replacedBody.body;
        } else {
            existingStatements = [replacedBody];
        }

        return {
            type: 'ForInStatement',
            left: node.left,
            right: node.right,
            body: {
                type: 'BlockStatement',
                body: [this._energyCheckCall(), ...existingStatements],
            },
        };
    }

    private _replaceForOfStatement(node: any): any {
        let replacedBody = node.body;

        let existingStatements: any[] = [];
        if (replacedBody.type === 'BlockStatement') {
            existingStatements = replacedBody.body;
        } else {
            existingStatements = [replacedBody];
        }

        return {
            type: 'ForOfStatement',
            left: node.left,
            right: node.right,
            body: {
                type: 'BlockStatement',
                body: [this._energyCheckCall(), ...existingStatements],
            },
        };
    }

    private _energyCheckCall() {
        return {
            type: 'ExpressionStatement',
            expression: {
                type: 'CallExpression',
                callee: {
                    type: 'Identifier',
                    name: '__energyCheck',
                },
                arguments: [] as any[],
            },
        };
    }

    replaceMacros(formula: string) {
        if (!formula) {
            return formula;
        }

        for (let m of this.macros) {
            formula = formula.replace(m.test, m.replacement);
        }

        return formula;
    }
}
