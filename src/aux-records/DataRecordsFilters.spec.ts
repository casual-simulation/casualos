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
import {
    buildPrismaJsonWhereFilter,
    matchesDataFilter,
    parseDataFilter,
} from './DataRecordsFilters';

describe('parseDataFilter()', () => {
    it('should return a failure when given null or undefined', () => {
        expect(parseDataFilter(null).success).toBe(false);
        expect(parseDataFilter(undefined).success).toBe(false);
    });

    it('should return a failure when given a non-object', () => {
        expect(parseDataFilter('abc').success).toBe(false);
        expect(parseDataFilter(123).success).toBe(false);
        expect(parseDataFilter([1, 2, 3]).success).toBe(false);
    });

    it('should return a failure when given an empty object', () => {
        expect(parseDataFilter({}).success).toBe(false);
    });

    const operatorCases: [string, any][] = [
        ['$eq', { abc: { $eq: 'def' } }],
        ['$gt', { num: { $gt: 10 } }],
        ['$gte', { num: { $gte: 10 } }],
        ['$lt', { num: { $lt: 10 } }],
        ['$lte', { num: { $lte: 10 } }],
        ['$in', { prop1: { $in: ['abc', 'def', 123, true] } }],
        ['$startsWith', { name: { $startsWith: 'abc' } }],
        ['$endsWith', { name: { $endsWith: 'abc' } }],
        ['$contains', { name: { $contains: 'abc' } }],
        ['$isNull', { name: { $isNull: true } }],
    ];

    it.each(operatorCases)('should accept a valid %s filter', (op, filter) => {
        const result = parseDataFilter(filter);
        expect(result.success).toBe(true);
    });

    it('should accept $and combinations', () => {
        const result = parseDataFilter({
            $and: [{ prop1: { $eq: true } }, { prop2: { $eq: true } }],
        });
        expect(result.success).toBe(true);
    });

    it('should accept $or combinations', () => {
        const result = parseDataFilter({
            $or: [{ prop1: { $eq: true } }, { prop2: { $eq: true } }],
        });
        expect(result.success).toBe(true);
    });

    it('should accept $not', () => {
        const result = parseDataFilter({
            $not: { prop1: { $eq: true } },
        });
        expect(result.success).toBe(true);
    });

    it('should reject an unknown operator', () => {
        const result = parseDataFilter({ abc: { $regex: 'def' } });
        expect(result.success).toBe(false);
    });

    it('should accept a filter nested using the maximum of 5 combination expressions', () => {
        // Every additional $and/$or/$not also counts against the 5-combinator
        // limit, so the deepest reachable nesting chains exactly 5 of them.
        let filter: any = { prop: { $eq: true } };
        for (let i = 0; i < 5; i++) {
            filter = { $not: filter };
        }
        const result = parseDataFilter(filter);
        expect(result.success).toBe(true);
    });

    it('should reject more than 10 conditions in an $and array', () => {
        const conditions = [];
        for (let i = 0; i < 11; i++) {
            conditions.push({ [`prop${i}`]: { $eq: true } });
        }
        const result = parseDataFilter({ $and: conditions });
        expect(result.success).toBe(false);
    });

    it('should accept up to 10 conditions in an $and array', () => {
        const conditions = [];
        for (let i = 0; i < 10; i++) {
            conditions.push({ [`prop${i}`]: { $eq: true } });
        }
        const result = parseDataFilter({ $and: conditions });
        expect(result.success).toBe(true);
    });

    it('should reject more than 5 total combination expressions', () => {
        // 1 outer $and + 5 inner $or = 6 total combinators, over the limit of 5.
        const result = parseDataFilter({
            $and: [
                { $or: [{ a: { $eq: 1 } }, { b: { $eq: 2 } }] },
                { $or: [{ c: { $eq: 1 } }, { d: { $eq: 2 } }] },
                { $or: [{ e: { $eq: 1 } }, { f: { $eq: 2 } }] },
                { $or: [{ g: { $eq: 1 } }, { h: { $eq: 2 } }] },
                { $or: [{ i: { $eq: 1 } }, { j: { $eq: 2 } }] },
            ],
        });
        expect(result.success).toBe(false);
    });

    it('should accept exactly 5 total combination expressions', () => {
        // 1 outer $and + 4 inner $or = 5 total combinators, exactly at the limit.
        const result = parseDataFilter({
            $and: [
                { $or: [{ a: { $eq: 1 } }, { b: { $eq: 2 } }] },
                { $or: [{ c: { $eq: 1 } }, { d: { $eq: 2 } }] },
                { $or: [{ e: { $eq: 1 } }, { f: { $eq: 2 } }] },
                { $or: [{ g: { $eq: 1 } }, { h: { $eq: 2 } }] },
            ],
        });
        expect(result.success).toBe(true);
    });

    it('should reject strings longer than 200 characters', () => {
        const result = parseDataFilter({
            prop: { $eq: 'a'.repeat(201) },
        });
        expect(result.success).toBe(false);
    });

    it('should accept strings up to 200 characters', () => {
        const result = parseDataFilter({
            prop: { $eq: 'a'.repeat(200) },
        });
        expect(result.success).toBe(true);
    });

    it('should reject objects with more than 10 properties', () => {
        const filter: any = {};
        for (let i = 0; i < 11; i++) {
            filter[`prop${i}`] = { $eq: true };
        }
        const result = parseDataFilter(filter);
        expect(result.success).toBe(false);
    });

    it('should accept objects with up to 10 properties', () => {
        const filter: any = {};
        for (let i = 0; i < 10; i++) {
            filter[`prop${i}`] = { $eq: true };
        }
        const result = parseDataFilter(filter);
        expect(result.success).toBe(true);
    });

    it('should reject $in sets with more than 20 values', () => {
        const values = [];
        for (let i = 0; i < 21; i++) {
            values.push(i);
        }
        const result = parseDataFilter({ prop: { $in: values } });
        expect(result.success).toBe(false);
    });

    it('should accept $in sets with up to 20 values', () => {
        const values = [];
        for (let i = 0; i < 20; i++) {
            values.push(i);
        }
        const result = parseDataFilter({ prop: { $in: values } });
        expect(result.success).toBe(true);
    });
});

describe('matchesDataFilter()', () => {
    const cases: [boolean, any, any][] = [
        [true, { abc: 'def' }, { abc: { $eq: 'def' } }],
        [false, { abc: 'xyz' }, { abc: { $eq: 'def' } }],
        [true, { num: 11 }, { num: { $gt: 10 } }],
        [false, { num: 10 }, { num: { $gt: 10 } }],
        [true, { num: 10 }, { num: { $gte: 10 } }],
        [true, { num: 9 }, { num: { $lt: 10 } }],
        [false, { num: 10 }, { num: { $lt: 10 } }],
        [true, { num: 10 }, { num: { $lte: 10 } }],
        [true, { prop1: 'abc' }, { prop1: { $in: ['abc', 'def'] } }],
        [false, { prop1: 'xyz' }, { prop1: { $in: ['abc', 'def'] } }],
        [true, { name: 'abcdef' }, { name: { $startsWith: 'abc' } }],
        [false, { name: 'defabc' }, { name: { $startsWith: 'abc' } }],
        [true, { name: 'defabc' }, { name: { $endsWith: 'abc' } }],
        [false, { name: 'abcdef' }, { name: { $endsWith: 'abc' } }],
        [true, { name: 'xyzabcdef' }, { name: { $contains: 'abc' } }],
        [false, { name: 'xyzdef' }, { name: { $contains: 'abc' } }],
        [true, { name: null }, { name: { $isNull: true } }],
        [true, {}, { name: { $isNull: true } }],
        [false, { name: 'abc' }, { name: { $isNull: true } }],
        [true, { name: 'abc' }, { name: { $isNull: false } }],
    ];

    it.each(cases)(
        'should return %s for %s given %s',
        (expected, data, filter) => {
            expect(matchesDataFilter(data, filter)).toBe(expected);
        }
    );

    it('should support $and', () => {
        const filter = {
            $and: [{ prop1: { $eq: true } }, { prop2: { $eq: true } }],
        };
        expect(matchesDataFilter({ prop1: true, prop2: true }, filter)).toBe(
            true
        );
        expect(matchesDataFilter({ prop1: true, prop2: false }, filter)).toBe(
            false
        );
    });

    it('should support $or', () => {
        const filter = {
            $or: [{ prop1: { $eq: true } }, { prop2: { $eq: true } }],
        };
        expect(matchesDataFilter({ prop1: true, prop2: false }, filter)).toBe(
            true
        );
        expect(matchesDataFilter({ prop1: false, prop2: false }, filter)).toBe(
            false
        );
    });

    it('should support $not', () => {
        const filter = {
            $not: { prop1: { $eq: true } },
        };
        expect(matchesDataFilter({ prop1: false }, filter)).toBe(true);
        expect(matchesDataFilter({ prop1: true }, filter)).toBe(false);
    });

    it('should support multiple operators on the same field as an implicit AND', () => {
        const filter = { num: { $gt: 5, $lt: 10 } };
        expect(matchesDataFilter({ num: 7 }, filter)).toBe(true);
        expect(matchesDataFilter({ num: 3 }, filter)).toBe(false);
        expect(matchesDataFilter({ num: 12 }, filter)).toBe(false);
    });
});

describe('buildPrismaJsonWhereFilter()', () => {
    it('should build a path/equals condition for $eq', () => {
        const result = buildPrismaJsonWhereFilter(
            { abc: { $eq: 'def' } },
            'data'
        );
        expect(result).toEqual({
            data: { path: ['abc'], equals: 'def' },
        });
    });

    it('should build an OR of equals conditions for $in', () => {
        const result = buildPrismaJsonWhereFilter(
            { prop1: { $in: ['abc', 'def'] } },
            'data'
        );
        expect(result).toEqual({
            OR: [
                { data: { path: ['prop1'], equals: 'abc' } },
                { data: { path: ['prop1'], equals: 'def' } },
            ],
        });
    });

    it('should build nested AND/OR/NOT conditions', () => {
        const result = buildPrismaJsonWhereFilter(
            {
                $and: [{ prop1: { $eq: true } }, { prop2: { $eq: true } }],
            },
            'data'
        );
        expect(result).toEqual({
            AND: [
                { data: { path: ['prop1'], equals: true } },
                { data: { path: ['prop2'], equals: true } },
            ],
        });
    });
});
