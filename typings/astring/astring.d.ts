declare module 'astring' {
    export function generate(node: any, options: {
        indent?: string;
        lineEnd?: string;
        startingIndentLevel?: number;
        comments?: boolean;
        generator: any;
    }): string;

    export const baseGenerator: object;
}