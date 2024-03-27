import { GenericHttpRequest } from '../http/GenericHttpInterface';
import z, { input } from 'zod';
import { KnownErrorCodes } from './ErrorCodes';

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
}

export type ProcedureOutput = ProcedureOutputSuccess | ProcedureOutputError;

export interface ProcedureOutputSuccess {
    success: true;
}

export interface ProcedureOutputError {
    success: false;
    errorCode: KnownErrorCodes;
}

/**
 * Defines a basic interface for a single RPC call.
 */
export interface Procedure<TInput, TOutput extends ProcedureOutput> {
    /**
     * The schema that should be used for the input into the RPC.
     */
    schema: z.ZodType<TInput, z.ZodTypeDef, any>;

    /**
     * The handler for the RPC.
     * @param input The input that was parsed from the request.
     * @returns Returns a promise that resolves with the output of the RPC.
     */
    handler: (input: TInput, context: RPCContext) => Promise<TOutput>;

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
    [key: string]: Procedure<any, any>;
}

export interface CallProcedureOptions {
    /**
     * The session key that should be used instead of the one that is currently set on the client.
     */
    sessionKey?: string;
}

export type OnlyFirstArg<T> = T extends (input: infer U, ...args: any[]) => any
    ? (input: U, options?: CallProcedureOptions) => ReturnType<T>
    : never;

export type RemoteProcedures<T extends Procedures> = {
    [K in keyof T]: OnlyFirstArg<T[K]['handler']>;
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
    inputs<TInput>(
        schema: z.ZodType<TInput, z.ZodTypeDef, any>
    ): OutputlessProcedureBuilder<TInput>;

    /**
     * Configures the handler for the RPC.
     * Because this is an inputless procedure, the input is void.
     * @param handler The handler.
     */
    handler<TOutput extends ProcedureOutput>(
        handler: (input: void, context: RPCContext) => Promise<TOutput>
    ): Procedure<void, TOutput>;
}

export interface OutputlessProcedureBuilder<TInput> extends ProcedureBuilder {
    /**
     * Configures the handler for the RPC.
     * @param handler The handler.
     */
    handler<TOutput extends ProcedureOutput>(
        handler: (input: TInput, context: RPCContext) => Promise<TOutput>
    ): Procedure<TInput, TOutput>;
}

/**
 * Constructs a new procedure.
 */
export function procedure(): InputlessProcedureBuilder {
    return new ProcBuilder();
}

class ProcBuilder
    implements OutputlessProcedureBuilder<any>, InputlessProcedureBuilder
{
    private _allowedOrigins: Set<string> | true | 'account' | 'api' | undefined;
    private _schema: z.ZodType<any, z.ZodTypeDef, any>;
    private _http: Procedure<any, any>['http'];

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

    inputs<TInput>(
        schema: z.ZodType<TInput, z.ZodTypeDef, any>
    ): OutputlessProcedureBuilder<TInput> {
        this._schema = schema;
        return this;
    }

    handler<TOutput extends ProcedureOutput>(
        handler: (input: any, context: RPCContext) => Promise<TOutput>
    ): Procedure<any, TOutput>;
    handler<TOutput extends ProcedureOutput>(
        handler: (input: void, context: RPCContext) => Promise<ProcedureOutput>
    ): Procedure<void, TOutput>;
    handler<TOutput extends ProcedureOutput>(
        handler: (input: any, context: RPCContext) => Promise<TOutput>
    ): Procedure<any, TOutput> {
        return {
            schema: this._schema,
            handler: handler,
            allowedOrigins: this._allowedOrigins,
            http: this._http,
        };
    }
}
