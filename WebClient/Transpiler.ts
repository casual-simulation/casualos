import {Parser, Node, TokenType, TokContext, tokTypes} from 'acorn';

export type ExJsNode = TokenValueNode;

export interface TokenValueNode extends Node {
    type: 'TokenValue';
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

function exJsParser(parser: typeof Parser) {
    return class ExJsParser extends parser {
        readToken(code: number) {
            if (isTagStart(code)) {
                console.log('Tag start');
                ++this.pos;
                return this.finishToken(tok.tag);
            }
            if (isObjectStart(code)) {
                console.log('Obj start');
                ++this.pos;
                return this.finishToken(tok.objRef);
            }

            return super.readToken(code);
        }

        parseExprAtom(refShortHandDefaultPos: any): Node {
            if(this.type === tok.tag) {
                console.log('Tag');
                return this.parseTag();
            } else if(this.type === tok.objRef) {
                console.log('Obj Ref');
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
            if(this.type === tokTypes.string) {
                node.identifier = this.parseLiteral(this.value);
            } else if(this.type === tokTypes.name) {
                node.identifier = this.parseIdent();
            } else {
                this.unexpected();
            }
            return this.finishNode(node, 'TagValue');
        }
    }
}

export class Transpiler {
    private _parser: typeof Parser;

    constructor() {
        this._parser = Parser.extend(<any>exJsParser);
    }

    transpile(code: string): string {
        const node = this._parser.parse(code);
        return code;
    }
}