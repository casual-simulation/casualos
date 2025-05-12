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
import type {
    GenericHttpRequest,
    GenericHttpResponse,
} from '../http/GenericHttpInterface';
import z from 'zod';
import type { KnownErrorCodes } from './ErrorCodes';
import type { Span } from '@opentelemetry/api';
import type { DenialReason } from '../common/DenialReason';

/**
 * Defines an interface for the context that an RPC call is made with.
 */
export interface RPCContext {
    /**
     * The IP Address that the RPC call is coming from.
     */
    ipAddress: string;

    /**
     * The session key that was included in the request.
     */
    sessionKey: string | null;

    /**
     * The HTTP request that the RPC call is coming from.
     */
    httpRequest?: GenericHttpRequest;

    /**
     * The HTTP origin that the request was made from.
     */
    origin: string | null;

    /**
     * The span that the RPC call is being made in.
     */
    span?: Span;
}

export type ProcedureOutput =
    | ProcedureOutputSuccess
    | ProcedureOutputError
    | ProcedureOutputStream;

export interface ProcedureOutputSuccess {
    success: true;
}

export interface ProcedureOutputError {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
    reason?: DenialReason;
}

export interface ProcedureOutputStream
    extends AsyncGenerator<
        any,
        ProcedureOutputSuccess | ProcedureOutputError
    > {}

/**
 * Defines a basic interface for a single RPC call.
 */
export interface Procedure<TInput, TOutput extends ProcedureOutput, TQuery> {
    /**
     * The schema that should be used for the input into the RPC.
     */
    schema: z.ZodType<TInput, z.ZodTypeDef, any>;

    /**
     * The schema that should be used for the query parameters into the RPC.
     */
    querySchema: z.ZodType<TQuery, z.ZodTypeDef, any> | null;

    /**
     * The handler for the RPC.
     * @param input The input that was parsed from the request.
     * @param context The context that the handler was called with.
     * @param query The query parameters that were parsed from the request.
     * @returns Returns a promise that resolves with the output of the RPC.
     */
    handler: (
        input: TInput,
        context: RPCContext,
        query?: TQuery
    ) => Promise<TOutput>;

    /**
     * The function that can map the output of the handler to an HTTP response.
     * @param output The output of the handler.
     * @param context The context that the handler was called with.
     */
    mapToResponse?: (
        output: TOutput,
        context: RPCContext
    ) => Promise<Partial<GenericHttpResponse>>;

    /**
     * The set of origins that are allowed for the route.
     * If true, then all origins are allowed.
     * If 'account', then only the configured account origins are allowed.
     * If 'api', then only the configured API origins are allowed.
     * If omitted, then it is up to the handler to determine if the origin is allowed.
     */
    allowedOrigins?: Set<string> | true | 'account' | 'api';

    /**
     * The HTTP-specific configuration for the procedure.
     */
    http?: {
        /**
         * The HTTP method that should be used for the route.
         */
        method: GenericHttpRequest['method'];

        /**
         * The path for the HTTP route.
         */
        path: string;
    };
}

export interface Procedures {
    [key: string]: Procedure<any, any, any>;
}

export interface CallProcedureOptions {
    /**
     * The session key that should be used instead of the one that is currently set on the client.
     */
    sessionKey?: string;

    /**
     * The endpoint that should be used instead of the one that is currently set on the client.
     */
    endpoint?: string;

    /**
     * The headers that should be included in the request.
     */
    headers?: Record<string, string>;
}

// export type AsyncIteratorToArray<T> = T extends AsyncIterator<
//     infer U,
//     infer R,
//     any
// >
//     ? [...U[], R]
//     : T;

// export type MapPromise<T> = T extends Promise<infer U>
//     ? Promise<AsyncIteratorToArray<U>>
//     : T;

// export type Returns = Promise<AsyncGenerator<number, string> | string>
// export type Func = (input: number, options?: CallProcedureOptions) => Returns;

// export type RetType = ReturnType<Func>
// export type Result = MapPromise<RetType>;

export type OnlyFirstArg<T> = T extends (input: infer U, ...args: any[]) => any
    ? (input: U, options?: CallProcedureOptions) => ReturnType<T>
    : never;

export type RemoteProcedures<T extends Procedures> = {
    [K in keyof T]: OnlyFirstArg<T[K]['handler']>;
};

export type ProcedureInputs<T extends Procedures> = {
    [K in keyof T]: z.infer<T[K]['schema']>;
};

export type ProcedureQueries<T extends Procedures> = {
    [K in keyof T]: z.infer<T[K]['querySchema']>;
};

export type ProcedureActions<T extends Procedures> = {
    [K in keyof T]: {
        input: ProcedureInputs<T>[K];
        query?: ProcedureQueries<T>[K];
    };
};

export interface ProcedureBuilder {
    /**
     * Configures the origins that are allowed for the route.
     * @param allowedOrigins The origins that are allowed.
     */
    origins(allowedOrigins: Set<string> | true | 'account' | 'api'): this;

    /**
     * Configures the HTTP method and path for this RPC.
     * @param method The method that should be used for http requests to this RPC.
     */
    http(method: GenericHttpRequest['method'], path: string): this;
}

export interface InputlessProcedureBuilder extends ProcedureBuilder {
    /**
     * Configures the input schema for the RPC.
     * @param schema The schema that inputs should conform to.
     */
    inputs<TInput, TQuery = any>(
        schema: z.ZodType<TInput, z.ZodTypeDef, any>,
        query?: z.ZodType<TQuery, z.ZodTypeDef, any>
    ): OutputlessProcedureBuilder<TInput, TQuery>;

    /**
     * Configures the handler for the RPC.
     * Because this is an inputless procedure, the input is void.
     * @param handler The handler.
     * @param mapToResponse The function that should be used to map the handler output to an HTTP response.
     */
    handler<TOutput extends ProcedureOutput>(
        handler: (input: void, context: RPCContext) => Promise<TOutput>,
        mapToResponse?: (
            output: TOutput,
            context: RPCContext
        ) => Promise<Partial<GenericHttpResponse>>
    ): Procedure<void, TOutput, void>;
}

export interface OutputlessProcedureBuilder<TInput, TQuery>
    extends ProcedureBuilder {
    /**
     * Configures the handler for the RPC.
     * @param handler The handler.
     * @param mapToResponse The function that should be used to map the handler output to an HTTP response.
     */
    handler<TOutput extends ProcedureOutput>(
        handler: (
            input: TInput,
            context: RPCContext,
            query?: TQuery
        ) => Promise<TOutput>,
        mapToResponse?: (
            output: TOutput,
            context: RPCContext
        ) => Promise<Partial<GenericHttpResponse>>
    ): Procedure<TInput, TOutput, TQuery>;
}

/**
 * Constructs a new procedure.
 */
export function procedure(): InputlessProcedureBuilder {
    return new ProcBuilder();
}

class ProcBuilder
    implements OutputlessProcedureBuilder<any, any>, InputlessProcedureBuilder
{
    private _allowedOrigins: Set<string> | true | 'account' | 'api' | undefined;
    private _schema: z.ZodType<any, z.ZodTypeDef, any>;
    private _querySchema: z.ZodType<any, z.ZodTypeDef, any>;
    private _http: Procedure<any, any, any>['http'];

    origins(allowedOrigins: Set<string> | true | 'account' | 'api'): this {
        this._allowedOrigins = allowedOrigins;
        return this;
    }

    http(method: GenericHttpRequest['method'], path: string): this {
        this._http = {
            method: method,
            path: path,
        };
        return this;
    }

    inputs<TInput, TQuery = any>(
        schema: z.ZodType<TInput, z.ZodTypeDef, any>,
        query?: z.ZodType<TQuery, z.ZodTypeDef, any>
    ): OutputlessProcedureBuilder<TInput, TQuery> {
        this._schema = schema;
        this._querySchema = query;
        return this;
    }

    handler<TOutput extends ProcedureOutput>(
        handler: (input: any, context: RPCContext) => Promise<TOutput>,
        mapToResponse?: (
            output: TOutput,
            context: RPCContext
        ) => Promise<Partial<GenericHttpResponse>>
    ): Procedure<any, TOutput, any>;
    handler<TOutput extends ProcedureOutput>(
        handler: (input: void, context: RPCContext) => Promise<ProcedureOutput>,
        mapToResponse?: (
            output: TOutput,
            context: RPCContext
        ) => Promise<Partial<GenericHttpResponse>>
    ): Procedure<void, TOutput, any>;
    handler<TOutput extends ProcedureOutput>(
        handler: (input: any, context: RPCContext) => Promise<TOutput>,
        mapToResponse?: (
            output: TOutput,
            context: RPCContext
        ) => Promise<Partial<GenericHttpResponse>>
    ): Procedure<any, TOutput, any> {
        return {
            schema: this._schema,
            querySchema: this._querySchema,
            handler: handler,
            mapToResponse,
            allowedOrigins: this._allowedOrigins,
            http: this._http,
        };
    }
}

export interface ProceduresMetadata {
    /**
     * The list of procedures.
     */
    procedures: ProcedureMetadata[];
}

export interface ProcedureMetadata {
    /**
     * The name of the procedure.
     */
    name: string;

    /**
     * The schema that should be used for the input into the RPC.
     */
    inputs: SchemaMetadata;

    /**
     * The schema that should be used for the query parameters into the RPC.
     * Most procedures do not have distinct query parameters, but some that deal directly with HTTP requests do (such as webhooks).
     */
    query?: SchemaMetadata;

    /**
     * The set of origins that are allowed for the route.
     * If true, then all origins are allowed.
     * If 'account', then only the configured account origins are allowed.
     * If 'api', then only the configured API origins are allowed.
     * If omitted, then it is up to the handler to determine if the origin is allowed.
     */
    origins?: Set<string> | true | 'account' | 'api';

    /**
     * The HTTP-specific configuration for the procedure.
     */
    http?: {
        /**
         * The HTTP method that should be used for the route.
         */
        method: GenericHttpRequest['method'];

        /**
         * The path for the HTTP route.
         */
        path: string;
    };
}

/**
 * Gets the metadata for the given procedures.
 * @param procedures The procedures to get metadata for.
 */
export function getProcedureMetadata(
    procedures: Procedures
): ProceduresMetadata {
    let metadatas: ProcedureMetadata[] = [];
    for (let procedure of Object.keys(procedures)) {
        const proc = procedures[procedure];
        metadatas.push({
            name: procedure,
            inputs: proc.schema ? getSchemaMetadata(proc.schema) : undefined,
            query: proc.querySchema
                ? getSchemaMetadata(proc.querySchema)
                : undefined,
            origins: proc.allowedOrigins,
            http: proc.http,
        });
    }

    return {
        procedures: metadatas,
    };
}

export interface BaseSchemaMetadata {
    type: string;
    nullable?: boolean;
    optional?: boolean;
    description?: string;

    hasDefault?: boolean;
    defaultValue?: any;
}

export interface StringSchemaMetadata extends BaseSchemaMetadata {
    type: 'string';
}

export interface BooleanSchemaMetadata extends BaseSchemaMetadata {
    type: 'boolean';
}

export interface NumberSchemaMetadata extends BaseSchemaMetadata {
    type: 'number';
}

export interface ObjectSchemaMetadata extends BaseSchemaMetadata {
    type: 'object';
    schema: Record<string, SchemaMetadata>;
    catchall?: SchemaMetadata;
}

export interface ArraySchemaMetadata extends BaseSchemaMetadata {
    type: 'array';
    schema: SchemaMetadata;
    maxLength?: number;
    minLength?: number;
    exactLength?: number;
}

export interface LiteralSchemaMetadata extends BaseSchemaMetadata {
    type: 'literal';
    value: any;
}

export interface EnumSchemaMetadata extends BaseSchemaMetadata {
    type: 'enum';
    values: string[];
}

export interface DateSchemaMetadata extends BaseSchemaMetadata {
    type: 'date';
}

export interface AnySchemaMetadata extends BaseSchemaMetadata {
    type: 'any';
}

export interface NullSchemaMetadata extends BaseSchemaMetadata {
    type: 'null';
}

export interface UnionSchemaMetadata extends BaseSchemaMetadata {
    type: 'union';
    options: SchemaMetadata[];
}

export interface DiscriminatedUnionSchemaMetadata extends UnionSchemaMetadata {
    options: ObjectSchemaMetadata[];
    discriminator: string;
}

export interface RecordSchemaMetadata extends BaseSchemaMetadata {
    type: 'record';

    /**
     * The schema of the values in the record.
     */
    valueSchema: SchemaMetadata;
}

export type SchemaMetadata =
    | StringSchemaMetadata
    | BooleanSchemaMetadata
    | NumberSchemaMetadata
    | ObjectSchemaMetadata
    | ArraySchemaMetadata
    | LiteralSchemaMetadata
    | EnumSchemaMetadata
    | DateSchemaMetadata
    | AnySchemaMetadata
    | NullSchemaMetadata
    | UnionSchemaMetadata
    | DiscriminatedUnionSchemaMetadata
    | RecordSchemaMetadata;

/**
 * Gets a serializable version of the schema metdata.
 * @param schema The schema to get metadata for.
 */
export function getSchemaMetadata(schema: z.ZodType): SchemaMetadata {
    if (schema instanceof z.ZodString) {
        return { type: 'string', description: schema._def.description };
    } else if (schema instanceof z.ZodBoolean) {
        return { type: 'boolean', description: schema._def.description };
    } else if (schema instanceof z.ZodNumber) {
        return { type: 'number', description: schema._def.description };
    } else if (schema instanceof z.ZodAny) {
        return { type: 'any', description: schema._def.description };
    } else if (schema instanceof z.ZodNull) {
        return { type: 'null', description: schema._def.description };
    } else if (schema instanceof z.ZodObject) {
        const schemaMetadata: Record<string, SchemaMetadata> = {};
        for (let key in schema.shape) {
            schemaMetadata[key] = getSchemaMetadata(schema.shape[key]);
        }
        return {
            type: 'object',
            schema: schemaMetadata,
            catchall: schema._def.catchall
                ? getSchemaMetadata(schema._def.catchall)
                : undefined,
            description: schema._def.description,
        };
    } else if (schema instanceof z.ZodArray) {
        return {
            type: 'array',
            schema: getSchemaMetadata(schema._def.type),
            maxLength: schema._def.maxLength?.value,
            minLength: schema._def.minLength?.value,
            exactLength: schema._def.exactLength?.value,
            description: schema._def.description,
        };
    } else if (schema instanceof z.ZodEnum) {
        return {
            type: 'enum',
            values: [...schema._def.values],
            description: schema._def.description,
        };
    } else if (schema instanceof z.ZodDate) {
        return { type: 'date', description: schema._def.description };
    } else if (schema instanceof z.ZodLiteral) {
        return {
            type: 'literal',
            value: schema.value,
            description: schema._def.description,
        };
    } else if (schema instanceof z.ZodOptional) {
        return { ...getSchemaMetadata(schema._def.innerType), optional: true };
    } else if (schema instanceof z.ZodNullable) {
        return { ...getSchemaMetadata(schema._def.innerType), nullable: true };
    } else if (schema instanceof z.ZodDefault) {
        return {
            ...getSchemaMetadata(schema._def.innerType),
            hasDefault: true,
            defaultValue: schema._def.defaultValue(),
        };
    } else if (schema instanceof z.ZodNever) {
        return undefined;
    } else if (schema instanceof z.ZodEffects) {
        return { ...getSchemaMetadata(schema._def.schema) };
    } else if (schema instanceof z.ZodUnion) {
        return {
            type: 'union',
            options: schema._def.options.map((o: any) => getSchemaMetadata(o)),
            description: schema._def.description,
        };
    } else if (schema instanceof z.ZodDiscriminatedUnion) {
        return {
            type: 'union',
            options: schema._def.options.map((o: any) => getSchemaMetadata(o)),
            discriminator: schema._def.discriminator,
            description: schema._def.description,
        };
    } else if (schema instanceof z.ZodRecord) {
        return {
            type: 'record',
            valueSchema: getSchemaMetadata(schema._def.valueType),
        };
    } else {
        console.error('Unsupported schema type', schema);
        throw new Error(`Unsupported schema type: ${schema}`);
    }
}
