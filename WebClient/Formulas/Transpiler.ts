import {Parser, Node, TokenType, TokContext, tokTypes} from 'acorn';
import {generate, baseGenerator} from 'astring';
import {replace} from 'estraverse';
import {assign} from 'lodash';
import * as LRU from 'lru-cache';

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
                node.identifier = this.parseIdent();
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
                node.identifier = this.parseIdent();
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
 * Defines a class that is able to compile code from File Simulator's custom JavaScript dialect
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
                // #tag syntax
                if (n.type === 'TagValue' && n.identifier) {
                    // _listTagValues('tag')
                    return callExpr('_listTagValues', [{
                        type: 'Literal',
                        value: (n.identifier.name || n.identifier.value)
                    }]);

                    // #tag(filter) syntax
                } else if(n.type === 'CallExpression' && 
                          n.callee.type === 'TagValue' &&
                          n.callee.identifier) {
                    return callExpr('_listTagValues', [{
                        type: 'Literal',
                        value: (n.callee.identifier.name || n.callee.identifier.value)
                    }, ...n.arguments]);

                    // @tag syntax
                } else if(n.type === 'ObjectValue' && n.identifier) {
                    // _listObjectsWithTag('tag')
                    return callExpr('_listObjectsWithTag', [{
                        type: 'Literal',
                        value: (n.identifier.name || n.identifier.value)
                    }]);

                    // @tag(filter) syntax
                } else if(n.type === 'CallExpression' &&
                          n.callee.type === 'ObjectValue' &&
                          n.callee.identifier){
                    // _listObjectsWithTag('tag', filter)
                    return callExpr('_listObjectsWithTag', [{
                        type: 'Literal',
                        value: (n.callee.identifier.name || n.callee.identifier.value)
                    }, ...n.arguments]);
                }
            })
        });
    }

    private _toJs(node: Node): string {
        return generate(node, {
            generator: exJsGenerator
        });
    }
}