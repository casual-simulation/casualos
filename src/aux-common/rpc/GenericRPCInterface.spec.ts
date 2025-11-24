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
    getProcedureMetadata,
    getSchemaMetadata,
    procedure,
} from './GenericRPCInterface';
import z from 'zod';

describe('procedure()', () => {
    it('should be able to create a new procedure', async () => {
        const proc = procedure()
            .origins(true)
            .inputs(z.string())
            .handler(async (str) => ({
                success: true,
                value: `hello ${str}`,
            }));

        expect(await proc.handler('world', null as any)).toEqual({
            success: true,
            value: 'hello world',
        });
        expect(proc.allowedOrigins).toBe(true);
    });
});

describe('getProcedureMetadata()', () => {
    it('should return a metadata object for the procedures', () => {
        const procedures = {
            proc: procedure()
                .origins(true)
                .inputs(z.string())
                .handler(async (str) => ({
                    success: true,
                    value: `hello ${str}`,
                })),
            proc2: procedure()
                .origins('account')
                .http('POST', '/api/proc2')
                .inputs(z.object({ name: z.string() }))
                .handler(async (input) => ({
                    success: true,
                    value: `hello ${input.name}`,
                })),
            proc3: procedure()
                .origins('account')
                .http('POST', '/api/proc2')
                .handler(async () => ({
                    success: true,
                    value: `hello`,
                })),
            query: procedure()
                .origins('account')
                .http('POST', '/api/query')
                .inputs(z.boolean(), z.string())
                .handler(async (input) => ({
                    success: true,
                    value: `hello ${input}`,
                })),
        };

        const meta = getProcedureMetadata(procedures);

        expect(meta).toEqual({
            procedures: [
                {
                    name: 'proc',
                    origins: true,
                    inputs: {
                        type: 'string',
                    },
                    http: undefined,
                },
                {
                    name: 'proc2',
                    origins: 'account',
                    inputs: {
                        type: 'object',
                        schema: {
                            name: {
                                type: 'string',
                            },
                        },
                    },
                    http: {
                        method: 'POST',
                        path: '/api/proc2',
                    },
                },
                {
                    name: 'proc3',
                    origins: 'account',
                    inputs: undefined,
                    http: {
                        method: 'POST',
                        path: '/api/proc2',
                    },
                },
                {
                    name: 'query',
                    origins: 'account',
                    inputs: {
                        type: 'boolean',
                    },
                    query: {
                        type: 'string',
                    },
                    http: {
                        method: 'POST',
                        path: '/api/query',
                    },
                },
            ],
        });
    });
});

describe('getSchemaMetadata()', () => {
    const cases = [
        ['string', z.string(), { type: 'string' }] as const,
        ['boolean', z.boolean(), { type: 'boolean' }] as const,
        ['number', z.number(), { type: 'number' }] as const,
        ['any', z.any(), { type: 'any' }] as const,
        ['null', z.null(), { type: 'null' }] as const,
        ['object', z.object({}), { type: 'object', schema: {} }] as const,
        [
            'object with properties',
            z.object({
                abc: z.number(),
                def: z.string(),
                bool: z.boolean(),
            }),
            {
                type: 'object',
                schema: {
                    abc: { type: 'number' },
                    def: { type: 'string' },
                    bool: { type: 'boolean' },
                },
            },
        ] as const,
        [
            'object with catchall',
            z.object({}).catchall(z.number()),
            { type: 'object', schema: {}, catchall: { type: 'number' } },
        ] as const,
        [
            'array',
            z.array(z.string()),
            { type: 'array', schema: { type: 'string' } },
        ] as const,
        [
            'array with exact length',
            z.array(z.string()).length(2),
            { type: 'array', schema: { type: 'string' }, exactLength: 2 },
        ] as const,
        [
            'array with min length',
            z.array(z.string()).min(2),
            { type: 'array', schema: { type: 'string' }, minLength: 2 },
        ] as const,
        [
            'array with max length',
            z.array(z.string()).max(2),
            { type: 'array', schema: { type: 'string' }, maxLength: 2 },
        ] as const,
        [
            'literal string',
            z.literal('abc'),
            { type: 'literal', value: 'abc' },
        ] as const,
        [
            'literal number',
            z.literal(123),
            { type: 'literal', value: 123 },
        ] as const,
        [
            'literal boolean',
            z.literal(true),
            { type: 'literal', value: true },
        ] as const,
        [
            'enum',
            z.enum(['abc', 'def', 'ghi']),
            { type: 'enum', values: ['abc', 'def', 'ghi'] },
        ] as const,
        ['date', z.date(), { type: 'date' }] as const,
        [
            'preprocess',
            z.preprocess((value) => value, z.string()),
            { type: 'string' },
        ] as const,
        [
            'union',
            z.union([z.string(), z.number()]),
            {
                type: 'union',
                options: [{ type: 'string' }, { type: 'number' }],
            },
        ] as const,
        [
            'discriminated union',
            z.discriminatedUnion('abc', [
                z.object({
                    abc: z.literal(123),
                }),
                z.object({
                    abc: z.literal(456),
                }),
            ]),
            {
                type: 'union',
                discriminator: 'abc',
                options: [
                    {
                        type: 'object',
                        schema: {
                            abc: { type: 'literal', value: 123 },
                        },
                    },
                    {
                        type: 'object',
                        schema: {
                            abc: { type: 'literal', value: 456 },
                        },
                    },
                ],
            },
        ] as const,
    ] as const;

    it.each(cases)(
        'should return the metadata for %s',
        (name, schema, expected) => {
            expect(getSchemaMetadata(schema)).toEqual(expected);
        }
    );

    it.each(cases)(
        'should support nullable metadata for %s',
        (name, schema, expected) => {
            expect(getSchemaMetadata(schema.nullable())).toEqual({
                ...expected,
                nullable: true,
            });
        }
    );

    it.each(cases)(
        'should support default metadata for %s',
        (name, schema, expected) => {
            expect(
                getSchemaMetadata((schema as any).default(123 as any))
            ).toEqual({ ...expected, hasDefault: true, defaultValue: 123 });
        }
    );

    it.each(cases)(
        'should support optional metadata for %s',
        (name, schema, expected) => {
            expect(getSchemaMetadata(schema.optional())).toEqual({
                ...expected,
                optional: true,
            });
        }
    );

    it.each(cases)(
        'should support nullable and optional metadata for %s',
        (name, schema, expected) => {
            expect(getSchemaMetadata(schema.optional().nullable())).toEqual({
                ...expected,
                optional: true,
                nullable: true,
            });
        }
    );

    it.each(cases)(
        'should support descriptions for %s',
        (name, schema, expected) => {
            if (!(schema instanceof z.core.$ZodPipe)) {
                expect(
                    getSchemaMetadata(schema.describe('this is a description'))
                ).toEqual({
                    ...expected,
                    description: 'this is a description',
                });
            }
        }
    );
});
