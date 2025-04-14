/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
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
