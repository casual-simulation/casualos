/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const errorRegexp = /^Error:?\s*$/;

const removeBlankErrorLine = (str: string) =>
    str
        .split('\n')
        // Lines saying just `Error:` are useless
        .filter((line) => !errorRegexp.test(line))
        .join('\n')
        .trimRight();

// jasmine and worker farm sometimes don't give us access to the actual
// Error object, so we have to regexp out the message from the stack string
// to format it.
export const separateMessageFromStack = (
    content: string
): { message: string; stack: string } => {
    if (!content) {
        return { message: '', stack: '' };
    }

    // All lines up to what looks like a stack -- or if nothing looks like a stack
    // (maybe it's a code frame instead), just the first non-empty line.
    // If the error is a plain "Error:" instead of a SyntaxError or TypeError we
    // remove the prefix from the message because it is generally not useful.
    const messageMatch = content.match(
        /^(?:Error: )?([\s\S]*?(?=\n\s*at\s.*:\d*:\d*)|\s*.*)([\s\S]*)$/
    );
    if (!messageMatch) {
        // For typescript
        throw new Error('If you hit this error, the regex above is buggy.');
    }
    const message = removeBlankErrorLine(messageMatch[1]);
    const stack = removeBlankErrorLine(messageMatch[2]);
    return { message, stack };
};
