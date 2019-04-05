import * as Acorn from 'acorn';
import {generate, baseGenerator} from 'astring';
import {replace} from 'estraverse';
import {assign} from 'lodash';
import LRU from 'lru-cache';

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
        parseSubscript(base: Acorn.Node, startPos: number, startLoc: number): Acorn.Node;
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

const tok = {
    tag: new Acorn.TokenType('tag'),
    objRef: new Acorn.TokenType('objRef')
};

function isTagStart(char: number) {
    return char === 35; // '#' char
}

function isObjectStart(char: number) {
    return char === 64; // '@' char
}

function callExpr(name: string, args: any[]) {
    return {
        type: 'CallExpression',
        callee: {
            type: 'Identifier',
            name: name
        },
        arguments: args
    };
}

function memberExpr(object: any, property: any) {
    return {
        type: 'MemberExpression',
        object: object,
        computed: property.type !== 'Identifier',
        property: property
    };
}

function ident(name: string) {
    return {
        type: 'Identifier',
        name: name
    };
}

function literal(raw: string) {
    return {
        type: 'Literal',
        raw: raw
    };
}

function exJsParser(parser: typeof Acorn.Parser) {
    return class ExJsParser extends parser {
        readToken(code: number) {
            if (isTagStart(code)) {
                ++this.pos;
                return this.finishToken(tok.tag);
            }
            if (isObjectStart(code)) {
                ++this.pos;
                return this.finishToken(tok.objRef);
            }

            return super.readToken(code);
        }

        parseExprAtom(refShortHandDefaultPos: any): Acorn.Node {
            if(this.type === tok.tag) {
                return this.parseTag();
            } else if(this.type === tok.objRef) {
                return this.parseObjRef();
            }
            return super.parseExprAtom(refShortHandDefaultPos);
        }

        parseTag(): Acorn.Node {
            const startPos = this.start;
            const startLoc = this.startLoc;
            this.next();
            return this.parseTagAt(startPos, startLoc);
        }

        parseTagAt(startPos: number, startLoc: number): Acorn.Node {
            let node: ExJsNode = <any>this.startNodeAt(startPos, startLoc);
            node.identifier = null;
            if(this.type === Acorn.tokTypes.string) {
                node.identifier = this.parseLiteral(this.value);
            } else if(this.type === Acorn.tokTypes.name) {
                const expr = this.parseExprAtom(null);
                let base = expr;
                let element;
                while (true) {
                    element = super.parseSubscript(base, startPos, startLoc);
                    if(element === base || element.type === 'CallExpression') break;
                    base = element;
                }
                node.identifier = element;
            } else if(this.type === Acorn.tokTypes.parenL) {
            } else {
                this.unexpected();
            }
            return this.finishNode(node, 'TagValue');
        }

        parseObjRef(): Acorn.Node {
            const startPos = this.start;
            const startLoc = this.startLoc;
            this.next();
            return this.parseObjRefAt(startPos, startLoc);
        }

        parseObjRefAt(startPos: number, startLoc: number): Acorn.Node {
            let node: ExJsNode = <any>this.startNodeAt(startPos, startLoc);
            node.identifier = null;
            if(this.type === Acorn.tokTypes.string) {
                node.identifier = this.parseLiteral(this.value);
            } else if(this.type === Acorn.tokTypes.name) {
                const expr = this.parseExprAtom(null);
                let base = expr;
                let element;
                while (true) {
                    element = super.parseSubscript(base, startPos, startLoc);
                    if (element === base || element.type === 'CallExpression') break;
                    base = element;
                }
                node.identifier = element;
            } else if(this.type === Acorn.tokTypes.parenL) {
            } else {
                this.unexpected();
            }
            return this.finishNode(node, 'ObjectValue');
        }
    }
}

const exJsGenerator = assign({}, baseGenerator, {});

/**
 * Defines a class that is able to compile code from AUX's custom JavaScript dialect
 * into pure ES6 JavaScript. Does not preserve spacing or comments.
 * 
 * See https://docs.google.com/document/d/1WQXQPjdXxyx_lau15WPpwTTYvt66_wPCu3x-08rpLoY/edit?usp=sharing
 */
export class Transpiler {
    private _parser: typeof Acorn.Parser;
    private _cache: LRU.Cache<string, string>;

    constructor() {
        this._cache = new LRU<string, string>({
            max: 1000,
        });
        this._parser = Acorn.Parser.extend(<any>exJsParser);
    }

    /**
     * Transpiles the given code into ES6 JavaScript Code.
     */
    transpile(code: string): string {
        const cached = this._cache.get(code);
        if (cached) {
            return cached;
        }
        const node = this._parser.parse(code);
        const replaced = this._replace(node);
        const final = this._toJs(replaced);
        this._cache.set(code, final);
        return final;
    }

    private _replace(node: Acorn.Node): Acorn.Node {
        return <any>replace(<any>node, {
            enter: <any>((n: any) => {
                // #tag or #tag(filter) syntax
                // or @tag or @tag(filter) syntax
                if ((n.type === 'TagValue' || n.type === 'ObjectValue') && n.identifier) {
                    // _listTagValues('tag', filter)

                    let currentNode = n.identifier;
                    let identifier: any;
                    let args: any[] = [];
                    let nodes: any[] = [];

                    while(currentNode.type === 'MemberExpression') {
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
                        tag = this._toJs(identifier);
                    } else {
                        tag = (identifier.name || identifier.value);
                    }

                    const funcName = n.type === 'TagValue' ? '_listTagValues' : '_listObjectsWithTag';

                    const call = callExpr(funcName, [{
                        type: 'Literal',
                        value: tag
                    }, ...args]);

                    if (nodes.length === 0) {
                        return call;
                    } else {
                        return nodes.reduce((prev, curr) => {
                            let prop = curr.property;
                            return memberExpr(prev, prop);
                        }, call);
                    }

                } else if(n.type === 'CallExpression') {
                    if (n.callee.type === 'TagValue' || n.callee.type === 'ObjectValue') {
                        if (n.callee.identifier) {

                            let identifier = n.callee.identifier;
                            let tag: string = (identifier.name || identifier.value);

                            const funcName = n.callee.type === 'TagValue' ? '_listTagValues' : '_listObjectsWithTag';
                            return callExpr(funcName, [{
                                type: 'Literal',
                                value: tag
                            }, ...n.arguments]);
                        }
                    }
                }
            })
        });
    }

    private _toJs(node: Acorn.Node): string {
        return generate(<any>node, {
            generator: exJsGenerator
        });
    }
}