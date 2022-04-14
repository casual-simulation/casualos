
export interface RegexRule {
    type: 'allow' | 'deny';
    pattern: string;
}

/**
 * Determines if the given value matches the given list of rules.
 * @param value The value to test.
 * @param rules The rules that the value should be tested against.
 */
export function isStringValid(value: string, rules: RegexRule[]) {
    if (rules.length <= 0) {
        return true;
    }

    const regexRules = rules.map((r) => ({
        type: r.type,
        pattern: new RegExp(r.pattern, 'i'),
    }));

    let good = false;
    for (let rule of regexRules) {
        if (rule.type === 'allow') {
            if (rule.pattern.test(value)) {
                good = true;
                break;
            }
        } else if (rule.type === 'deny') {
            if (rule.pattern.test(value)) {
                good = false;
                break;
            }
        }
    }

    return good;
}
