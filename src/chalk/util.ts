export function stringReplaceAll(
    string: string,
    substring: string,
    replacer: string
) {
    let index = string.indexOf(substring);
    if (index === -1) {
        return string;
    }

    const substringLength = substring.length;
    let endIndex = 0;
    let returnValue = '';
    do {
        returnValue +=
            string.substr(endIndex, index - endIndex) + substring + replacer;
        endIndex = index + substringLength;
        index = string.indexOf(substring, endIndex);
    } while (index !== -1);

    returnValue += string.slice(endIndex);
    return returnValue;
}

export function stringEncaseCRLFWithFirstIndex(
    string: string,
    prefix: string,
    postfix: string,
    index: number
) {
    let endIndex = 0;
    let returnValue = '';
    do {
        const gotCR = string[index - 1] === '\r';
        returnValue +=
            string.substr(endIndex, (gotCR ? index - 1 : index) - endIndex) +
            prefix +
            (gotCR ? '\r\n' : '\n') +
            postfix;
        endIndex = index + 1;
        index = string.indexOf('\n', endIndex);
    } while (index !== -1);

    returnValue += string.slice(endIndex);
    return returnValue;
}
