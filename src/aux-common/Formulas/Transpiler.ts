import {Parser, Node, TokenType, TokContext, tokTypes} from 'acorn';
import {generate, baseGenerator} from 'astring';
import {replace} from 'estraverse';
import {assign} from 'lodash';
import LRU from 'lru-cache';

declare module 'acorn' {
    /**
     * Extends the acorn parser interface.
     */
    interface Parser {
        type: TokenType;
        start: number;
        startLoc: number;
        value: string;
        pos: number;
        next(): void;
        parseLiteral(value: string): Node;
        parseIdent(): Node;
        parseExprSubscripts(): Node;
        unexpected(): void;
        startNodeAt(start: number, startLoc: number): Node;
        readToken(code: number): any;
        finishToken(token: TokenType): any;
        finishNode(node: Node, type: string): Node;
        parseExprAtom(refShortHandDefaultPos: any): Node;
        parseParenAndDistinguishExpression(canBeArrow: boolean): Node;
    }
}

export type ExJsNode = TokenValueNode | ObjectValueNode;

export interface TokenValueNode extends Node {
    type: 'TokenValue';
    identifier: Node;
}

export interface ObjectValueNode extends Node {
    type: 'ObjectValue';
    identifier: Node;
}

const tok = {
    tag: new TokenType('tag'),
    objRef: new TokenType('objRef')
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
        property: property
    };
}

function ident(name: string) {
    return {
        type: 'Identifier',
        name: name
    };
}

function exJsParser(parser: typeof Parser) {
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

        parseExprAtom(refShortHandDefaultPos: any): Node {
            if(this.type === tok.tag) {
                return this.parseTag();
            } else if(this.type === tok.objRef) {
                return this.parseObjRef();
            }
            return super.parseExprAtom(refShortHandDefaultPos);
        }

        parseTag(): Node {
            const startPos = this.start;
            const startLoc = this.startLoc;
            this.next();
            return this.parseTagAt(startPos, startLoc);
        }

        parseTagAt(startPos: number, startLoc: number): Node {
            let node: ExJsNode = <any>this.startNodeAt(startPos, startLoc);
            node.identifier = null;
            if(this.type === tokTypes.string) {
                node.identifier = this.parseLiteral(this.value);
            } else if(this.type === tokTypes.name) {
                node.identifier = this.parseExprSubscripts();
            } else if(this.type === tokTypes.parenL) {
            } else {
                this.unexpected();
            }
            return this.finishNode(node, 'TagValue');
        }

        parseObjRef(): Node {
            const startPos = this.start;
            const startLoc = this.startLoc;
            this.next();
            return this.parseObjRefAt(startPos, startLoc);
        }

        parseObjRefAt(startPos: number, startLoc: number): Node {
            let node: ExJsNode = <any>this.startNodeAt(startPos, startLoc);
            node.identifier = null;
            if(this.type === tokTypes.string) {
                node.identifier = this.parseLiteral(this.value);
            } else if(this.type === tokTypes.name) {
                node.identifier = this.parseExprSubscripts();
            } else if(this.type === tokTypes.parenL) {
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
    private _parser: typeof Parser;
    private _cache: LRU.Cache<string, string>;

    constructor() {
        this._cache = new LRU<string, string>({
            max: 1000,
        });
        this._parser = Parser.extend(<any>exJsParser);
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

    private _replace(node: Node): Node {
        return <any>replace(<any>node, {
            enter: <any>((n: any) => {
                // #tag or #tag(filter) syntax
                // or @tag or @tag(filter) syntax
                if ((n.type === 'TagValue' || n.type === 'ObjectValue') && n.identifier) {
                    // _listTagValues('tag', filter)

                    let properties: any[] = [];
                    let currentNode = n.identifier;
                    let identifier: any;
                    let args: any[] = [];

                    while(currentNode.type === 'MemberExpression') {
                        currentNode = currentNode.object;
                    }

                    if (currentNode.type === 'CallExpression') {
                        identifier = currentNode.callee;
                        args = currentNode.arguments;

                        currentNode = n.identifier;

                        let nodes: any[] = [];
                        while (currentNode.type === 'MemberExpression') {
                            nodes.unshift(currentNode);
                            currentNode = currentNode.object;
                        }

                        properties.push(...nodes.map(n => n.property.name));
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

                    if (properties.length === 0) {
                        return call;
                    } else {
                        return properties.reduce((prev, curr) => {
                            return memberExpr(prev, ident(curr));
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

    private _toJs(node: Node): string {
        return generate(<any>node, {
            generator: exJsGenerator
        });
    }
}