export interface EmailRule {
    type: 'allow' | 'deny';
    pattern: string;
}

export function isEmailValid(email: string, rules: EmailRule[]) {
    if (rules.length <= 0) {
        return true;
    }

    const emailRules = rules.map((r) => ({
        type: r.type,
        pattern: new RegExp(r.pattern, 'i'),
    }));

    let good = false;
    for (let rule of emailRules) {
        if (rule.type === 'allow') {
            if (rule.pattern.test(email)) {
                good = true;
                break;
            }
        } else if (rule.type === 'deny') {
            if (rule.pattern.test(email)) {
                good = false;
                break;
            }
        }
    }

    return good;
}
