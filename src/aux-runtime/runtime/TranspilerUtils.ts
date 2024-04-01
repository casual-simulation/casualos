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

/**
 * Calculates the character index that the given location occurrs at in the given string.
 * @param code The string.
 * @param location The location to get the index of. LIne and column numbers are zero-based.
 */
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
        } else if (column > 0) {
            column -= 1;
            if (char === '\n') {
                index++;
                break;
            }
        } else {
            break;
        }
    }

    return index;
}

/**
 * Calculates the line and column number that the given index occurrs at in the given string.
 * @param code The code.
 * @param index The index.
 */
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
