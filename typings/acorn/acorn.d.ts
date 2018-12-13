import {Parser, TokenType, Node} from 'acorn';
declare module 'acorn' {
    interface Parser {
        type: TokenType;
        start: number;
        startLoc: number;
        value: string;
        pos: number;
        next(): void;
        parseLiteral(value: string): Node;
        parseIdent(): Node;
        unexpected(): void;
        startNodeAt(start: number, startLoc: number): Node;
        readToken(code: number): any;
        finishToken(token: TokenType): any;
        finishNode(node: Node, type: string): Node;
        parseExprAtom(refShortHandDefaultPos: any): Node;
        parseParenAndDistinguishExpression(canBeArrow: boolean): Node;
    }
}