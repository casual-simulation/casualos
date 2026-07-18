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

/**
 * The maximum depth that a data filter can be nested to.
 */
export const MAX_FILTER_DEPTH = 25;

/**
 * The maximum number of conditions that a single $and/$or array can contain.
 */
export const MAX_COMBINATOR_CONDITIONS = 10;

/**
 * The maximum number of combination expressions ($and, $or, $not) that are allowed in a filter.
 */
export const MAX_TOTAL_COMBINATORS = 5;

/**
 * The maximum length that a string value in a filter can be.
 */
export const MAX_FILTER_STRING_LENGTH = 200;

/**
 * The maximum number of properties that an object in a filter can have.
 */
export const MAX_FILTER_OBJECT_PROPERTIES = 10;

/**
 * The maximum number of values that a $in set can contain.
 */
export const MAX_FILTER_SET_VALUES = 20;

const FIELD_FILTER_OPERATORS = [
    '$eq',
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$in',
    '$startsWith',
    '$endsWith',
    '$contains',
    '$isNull',
] as const;

const COMBINATOR_KEYS = ['$and', '$or', '$not'] as const;

/**
 * A single scalar value that can appear in a data filter.
 */
export type DataFilterValue = string | number | boolean | null;

/**
 * Defines the operators that can be applied to a single field of the data.
 */
export interface DataFieldFilter {
    $eq?: DataFilterValue;
    $gt?: number | string;
    $gte?: number | string;
    $lt?: number | string;
    $lte?: number | string;
    $in?: DataFilterValue[];
    $startsWith?: string;
    $endsWith?: string;
    $contains?: string;
    $isNull?: boolean;
}

/**
 * Defines a filter that can be applied to JSON data.
 * Each key is either a combination expression ($and, $or, $not) or the name of a
 * property that should be tested with a DataFieldFilter.
 */
export interface DataFilter {
    $and?: DataFilter[];
    $or?: DataFilter[];
    $not?: DataFilter;
    [field: string]: DataFieldFilter | DataFilter[] | DataFilter | undefined;
}

/**
 * Defines the result of attempting to parse a data filter.
 */
export type ParseDataFilterResult =
    | {
          success: true;
          filter: DataFilter;
      }
    | {
          success: false;
          errorMessage: string;
      };

interface ParseContext {
    /**
     * The total number of combination expressions ($and, $or, $not) that have been
     * encountered so far while parsing the filter.
     */
    totalCombinators: number;
}

/**
 * Attempts to parse the given value as a data filter.
 * Returns a failure result if the value is not a valid filter, or if the filter
 * exceeds any of the size/depth limits.
 * @param value The value that should be parsed.
 */
export function parseDataFilter(value: unknown): ParseDataFilterResult {
    if (value === null || value === undefined) {
        return {
            success: false,
            errorMessage: 'filter must be an object.',
        };
    }

    const context: ParseContext = {
        totalCombinators: 0,
    };

    const result = _parseFilterNode(value, 1, context);
    if (result.success === false) {
        return result;
    }

    return {
        success: true,
        filter: result.filter,
    };
}

function _parseFilterNode(
    value: unknown,
    depth: number,
    context: ParseContext
): ParseDataFilterResult {
    if (depth > MAX_FILTER_DEPTH) {
        return {
            success: false,
            errorMessage: `filter must not be nested more than ${MAX_FILTER_DEPTH} levels deep.`,
        };
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return {
            success: false,
            errorMessage: 'filter must be an object.',
        };
    }

    const keys = Object.keys(value as object);
    if (keys.length === 0) {
        return {
            success: false,
            errorMessage: 'filter must have at least one property.',
        };
    }
    if (keys.length > MAX_FILTER_OBJECT_PROPERTIES) {
        return {
            success: false,
            errorMessage: `filter objects must not have more than ${MAX_FILTER_OBJECT_PROPERTIES} properties.`,
        };
    }

    const filter: DataFilter = {};

    for (let key of keys) {
        const propValue = (value as any)[key];

        if (key === '$and' || key === '$or') {
            context.totalCombinators += 1;
            if (context.totalCombinators > MAX_TOTAL_COMBINATORS) {
                return {
                    success: false,
                    errorMessage: `filters must not contain more than ${MAX_TOTAL_COMBINATORS} combination expressions ($and, $or, $not).`,
                };
            }

            if (!Array.isArray(propValue)) {
                return {
                    success: false,
                    errorMessage: `${key} must be an array of filters.`,
                };
            }
            if (propValue.length === 0) {
                return {
                    success: false,
                    errorMessage: `${key} must not be empty.`,
                };
            }
            if (propValue.length > MAX_COMBINATOR_CONDITIONS) {
                return {
                    success: false,
                    errorMessage: `${key} must not contain more than ${MAX_COMBINATOR_CONDITIONS} conditions.`,
                };
            }

            const parsedChildren: DataFilter[] = [];
            for (let child of propValue) {
                const childResult = _parseFilterNode(child, depth + 1, context);
                if (childResult.success === false) {
                    return childResult;
                }
                parsedChildren.push(childResult.filter);
            }

            filter[key] = parsedChildren;
        } else if (key === '$not') {
            context.totalCombinators += 1;
            if (context.totalCombinators > MAX_TOTAL_COMBINATORS) {
                return {
                    success: false,
                    errorMessage: `filters must not contain more than ${MAX_TOTAL_COMBINATORS} combination expressions ($and, $or, $not).`,
                };
            }

            const childResult = _parseFilterNode(propValue, depth + 1, context);
            if (childResult.success === false) {
                return childResult;
            }

            filter.$not = childResult.filter;
        } else {
            const fieldResult = _parseFieldFilter(key, propValue, depth);
            if (fieldResult.success === false) {
                return fieldResult;
            }
            filter[key] = fieldResult.filter;
        }
    }

    return {
        success: true,
        filter,
    };
}

function _parseFieldFilter(
    field: string,
    value: unknown,
    depth: number
): { success: true; filter: DataFieldFilter } | ParseDataFilterResult {
    if (field.length > MAX_FILTER_STRING_LENGTH) {
        return {
            success: false,
            errorMessage: `field names must not be longer than ${MAX_FILTER_STRING_LENGTH} characters.`,
        };
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return {
            success: false,
            errorMessage: `${field} must be an object that specifies a filter operator.`,
        };
    }

    const keys = Object.keys(value as object);
    if (keys.length === 0) {
        return {
            success: false,
            errorMessage: `${field} must specify at least one filter operator.`,
        };
    }
    if (keys.length > MAX_FILTER_OBJECT_PROPERTIES) {
        return {
            success: false,
            errorMessage: `filter objects must not have more than ${MAX_FILTER_OBJECT_PROPERTIES} properties.`,
        };
    }

    const result: DataFieldFilter = {};

    for (let key of keys) {
        if (!(FIELD_FILTER_OPERATORS as readonly string[]).includes(key)) {
            return {
                success: false,
                errorMessage: `${field}.${key} is not a supported filter operator.`,
            };
        }

        const opValue = (value as any)[key];

        if (key === '$in') {
            if (!Array.isArray(opValue)) {
                return {
                    success: false,
                    errorMessage: `${field}.$in must be an array of values.`,
                };
            }
            if (opValue.length > MAX_FILTER_SET_VALUES) {
                return {
                    success: false,
                    errorMessage: `${field}.$in must not contain more than ${MAX_FILTER_SET_VALUES} values.`,
                };
            }
            for (let v of opValue) {
                const valueResult = _validateScalarValue(`${field}.$in`, v);
                if (valueResult.success === false) {
                    return valueResult;
                }
            }
            result.$in = opValue;
        } else if (
            key === '$startsWith' ||
            key === '$endsWith' ||
            key === '$contains'
        ) {
            if (typeof opValue !== 'string') {
                return {
                    success: false,
                    errorMessage: `${field}.${key} must be a string.`,
                };
            }
            if (opValue.length > MAX_FILTER_STRING_LENGTH) {
                return {
                    success: false,
                    errorMessage: `${field}.${key} must not be longer than ${MAX_FILTER_STRING_LENGTH} characters.`,
                };
            }
            (result as any)[key] = opValue;
        } else if (key === '$isNull') {
            if (typeof opValue !== 'boolean') {
                return {
                    success: false,
                    errorMessage: `${field}.$isNull must be a boolean.`,
                };
            }
            result.$isNull = opValue;
        } else if (
            key === '$gt' ||
            key === '$gte' ||
            key === '$lt' ||
            key === '$lte'
        ) {
            if (typeof opValue !== 'number' && typeof opValue !== 'string') {
                return {
                    success: false,
                    errorMessage: `${field}.${key} must be a number or a string.`,
                };
            }
            if (
                typeof opValue === 'string' &&
                opValue.length > MAX_FILTER_STRING_LENGTH
            ) {
                return {
                    success: false,
                    errorMessage: `${field}.${key} must not be longer than ${MAX_FILTER_STRING_LENGTH} characters.`,
                };
            }
            (result as any)[key] = opValue;
        } else if (key === '$eq') {
            const valueResult = _validateScalarValue(`${field}.$eq`, opValue);
            if (valueResult.success === false) {
                return valueResult;
            }
            result.$eq = opValue;
        }
    }

    return {
        success: true,
        filter: result,
    };
}

function _validateScalarValue(
    path: string,
    value: unknown
): { success: true } | ParseDataFilterResult {
    if (
        value !== null &&
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean'
    ) {
        return {
            success: false,
            errorMessage: `${path} must be a string, number, boolean, or null.`,
        };
    }
    if (typeof value === 'string' && value.length > MAX_FILTER_STRING_LENGTH) {
        return {
            success: false,
            errorMessage: `${path} must not be longer than ${MAX_FILTER_STRING_LENGTH} characters.`,
        };
    }
    return { success: true };
}

/**
 * Determines if the given data matches the given filter.
 * @param data The data that should be tested.
 * @param filter The filter that the data should be tested against.
 */
export function matchesDataFilter(data: any, filter: DataFilter): boolean {
    for (let key of Object.keys(filter)) {
        if (key === '$and') {
            const children = filter.$and as DataFilter[];
            if (!children.every((child) => matchesDataFilter(data, child))) {
                return false;
            }
        } else if (key === '$or') {
            const children = filter.$or as DataFilter[];
            if (!children.some((child) => matchesDataFilter(data, child))) {
                return false;
            }
        } else if (key === '$not') {
            const child = filter.$not as DataFilter;
            if (matchesDataFilter(data, child)) {
                return false;
            }
        } else {
            const fieldFilter = filter[key] as DataFieldFilter;
            const fieldValue =
                data !== null && typeof data === 'object'
                    ? data[key]
                    : undefined;
            if (!_matchesFieldFilter(fieldValue, fieldFilter)) {
                return false;
            }
        }
    }

    return true;
}

function _matchesFieldFilter(
    value: any,
    fieldFilter: DataFieldFilter
): boolean {
    for (let op of Object.keys(fieldFilter) as (keyof DataFieldFilter)[]) {
        switch (op) {
            case '$eq':
                if (value !== fieldFilter.$eq) {
                    return false;
                }
                break;
            case '$gt':
                if (!(value > fieldFilter.$gt!)) {
                    return false;
                }
                break;
            case '$gte':
                if (!(value >= fieldFilter.$gte!)) {
                    return false;
                }
                break;
            case '$lt':
                if (!(value < fieldFilter.$lt!)) {
                    return false;
                }
                break;
            case '$lte':
                if (!(value <= fieldFilter.$lte!)) {
                    return false;
                }
                break;
            case '$in':
                if (!fieldFilter.$in!.includes(value)) {
                    return false;
                }
                break;
            case '$startsWith':
                if (
                    typeof value !== 'string' ||
                    !value.startsWith(fieldFilter.$startsWith!)
                ) {
                    return false;
                }
                break;
            case '$endsWith':
                if (
                    typeof value !== 'string' ||
                    !value.endsWith(fieldFilter.$endsWith!)
                ) {
                    return false;
                }
                break;
            case '$contains':
                if (
                    typeof value !== 'string' ||
                    !value.includes(fieldFilter.$contains!)
                ) {
                    return false;
                }
                break;
            case '$isNull': {
                const isNull = value === null || value === undefined;
                if (isNull !== fieldFilter.$isNull) {
                    return false;
                }
                break;
            }
        }
    }
    return true;
}

/**
 * Builds a Prisma JSON where-filter fragment for the given data filter.
 * The returned object is shaped like a Prisma `WhereInput` and can be merged
 * into a store's existing where clause via an `AND` array.
 * @param filter The filter that should be translated.
 * @param fieldName The name of the JSON column that the filter should be applied to.
 */
export function buildPrismaJsonWhereFilter(
    filter: DataFilter,
    fieldName: string
): any {
    const conditions: any[] = [];

    for (let key of Object.keys(filter)) {
        if (key === '$and') {
            conditions.push({
                AND: (filter.$and as DataFilter[]).map((child) =>
                    buildPrismaJsonWhereFilter(child, fieldName)
                ),
            });
        } else if (key === '$or') {
            conditions.push({
                OR: (filter.$or as DataFilter[]).map((child) =>
                    buildPrismaJsonWhereFilter(child, fieldName)
                ),
            });
        } else if (key === '$not') {
            conditions.push({
                NOT: buildPrismaJsonWhereFilter(
                    filter.$not as DataFilter,
                    fieldName
                ),
            });
        } else {
            const fieldFilter = filter[key] as DataFieldFilter;
            for (let op of Object.keys(
                fieldFilter
            ) as (keyof DataFieldFilter)[]) {
                if (op === '$in') {
                    conditions.push({
                        OR: fieldFilter.$in!.map((v) => ({
                            [fieldName]: { path: [key], equals: v },
                        })),
                    });
                } else {
                    conditions.push({
                        [fieldName]: _buildPrismaFieldCondition(
                            key,
                            op,
                            fieldFilter
                        ),
                    });
                }
            }
        }
    }

    if (conditions.length === 1) {
        return conditions[0];
    }

    return { AND: conditions };
}

function _buildPrismaFieldCondition(
    field: string,
    op: Exclude<keyof DataFieldFilter, '$in'>,
    fieldFilter: DataFieldFilter
): any {
    const path = [field];
    switch (op) {
        case '$eq':
            return { path, equals: fieldFilter.$eq };
        case '$gt':
            return { path, gt: fieldFilter.$gt };
        case '$gte':
            return { path, gte: fieldFilter.$gte };
        case '$lt':
            return { path, lt: fieldFilter.$lt };
        case '$lte':
            return { path, lte: fieldFilter.$lte };
        case '$startsWith':
            return { path, string_starts_with: fieldFilter.$startsWith };
        case '$endsWith':
            return { path, string_ends_with: fieldFilter.$endsWith };
        case '$contains':
            return { path, string_contains: fieldFilter.$contains };
        case '$isNull':
            return fieldFilter.$isNull
                ? { path, equals: null }
                : { path, not: null };
    }
}
