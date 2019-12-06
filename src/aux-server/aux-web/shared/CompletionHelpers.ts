export function propertyInsertText(property: string): string {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(property)) {
        return `.${property}`;
    } else {
        return `["${property}"]`;
    }
}
