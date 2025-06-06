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
import faker from 'faker';
import type { TagEdit } from '../bots';
import { applyEdit, del, edit, insert, preserve } from '../bots';

/**
 * Generates a set of random edit test cases that can be used to help fuzz test edit systems.
 * @param count The number of test cases to generate.
 */
export function generateRandomEditCases(
    count: number
): [string, string, string[], TagEdit[]][] {
    // Generate a bunch of
    let cases = [] as [string, string, string[], TagEdit[]][];
    for (let i = 0; i < count; i++) {
        const startText = faker.lorem.sentence();
        const editCount = faker.random.number({
            min: 1,
            max: startText.length,
        });
        let edits = [] as TagEdit[];
        let strings = [] as string[];
        let currentText = startText;

        for (let b = 0; b < editCount; b++) {
            const shouldInsert = faker.random.boolean();
            let tagEdit: TagEdit;
            if (shouldInsert || currentText.length <= 0) {
                const preserveCount = faker.random.number({
                    min: 0,
                    max: currentText.length,
                });
                const newText = faker.lorem.word();
                tagEdit = edit({}, preserve(preserveCount), insert(newText));
            } else {
                const preserveCount = faker.random.number({
                    min: 0,
                    max: currentText.length - 1,
                });
                const deleteCount = faker.random.number({
                    min: 1,
                    max: currentText.length - preserveCount,
                });
                tagEdit = edit({}, preserve(preserveCount), del(deleteCount));
            }
            edits.push(tagEdit);
            currentText = applyEdit(currentText, tagEdit);
            strings.push(currentText);
        }

        cases.push([startText, currentText, strings, edits]);
    }

    return cases;
}

/**
 * Generates a set of random edit test cases that spans multiple lines. Useful for fuzz testing text editing systems.
 * @param count The number of cases to generate.
 */
export function generateRandomEditParagraphCases(
    count: number
): [string, string, string[], TagEdit[]][] {
    // Generate a bunch of
    let cases = [] as [string, string, string[], TagEdit[]][];
    for (let i = 0; i < count; i++) {
        const startText = faker.lorem.paragraph(4);
        const editCount = faker.random.number({
            min: 1,
            max: startText.length,
        });
        let edits = [] as TagEdit[];
        let strings = [] as string[];
        let currentText = startText;

        for (let b = 0; b < editCount; b++) {
            const shouldInsert = faker.random.boolean();
            let tagEdit: TagEdit;
            if (shouldInsert || currentText.length <= 0) {
                const preserveCount = faker.random.number({
                    min: 0,
                    max: currentText.length,
                });
                const newText = faker.lorem.sentence();
                tagEdit = edit({}, preserve(preserveCount), insert(newText));
            } else {
                const preserveCount = faker.random.number({
                    min: 0,
                    max: currentText.length - 1,
                });
                const deleteCount = faker.random.number({
                    min: 1,
                    max: currentText.length - preserveCount,
                });
                tagEdit = edit({}, preserve(preserveCount), del(deleteCount));
            }
            edits.push(tagEdit);
            currentText = applyEdit(currentText, tagEdit);
            strings.push(currentText);
        }

        cases.push([startText, currentText, strings, edits]);
    }

    return cases;
}
