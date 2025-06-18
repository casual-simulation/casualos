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
    CallProcedureOptions,
    ProcedureActions,
    ProcedureInputs,
    ProcedureQueries,
    RemoteProcedures,
} from '@casual-simulation/aux-common';
import type { RecordsServer } from './RecordsServer';

export type RecordsClientType = RemoteProcedures<RecordsServer['procedures']>;
export type RecordsClientInputs = ProcedureInputs<RecordsServer['procedures']>;
export type RecordsClientQueries = ProcedureQueries<
    RecordsServer['procedures']
>;
export type RecordsClientActions = ProcedureActions<
    RecordsServer['procedures']
>;

/**
 * Defines a client that can be used to interact with the records API.
 */
export class RecordsClient {
    private _endpoint: string;
    private _sessionKey: string;

    get sessionKey() {
        return this._sessionKey;
    }

    set sessionKey(value: string) {
        this._sessionKey = value;
    }

    get endpoint() {
        return this._endpoint;
    }

    constructor(endpoint: string) {
        this._endpoint = endpoint;
        this._sessionKey = null;

        Object.defineProperties(this, {
            then: {
                value: undefined,
                configurable: false,
                writable: false,
            },
            catch: {
                value: undefined,
                configurable: false,
                writable: false,
            },
        });
    }

    /**
     * Calls the procedure with the given name, using the given argument.
     * @param name The name of the procedure to call.
     * @param input The input to the procedure.
     * @param options The options to use for the procedure.
     * @param query The query to use for the procedure.
     */
    async callProcedure(
        name: string,
        input: any,
        options?: CallProcedureOptions,
        query?: any
    ): Promise<any> {
        const response = await fetch(
            `${options?.endpoint ?? this._endpoint}/api/v3/callProcedure`,
            {
                method: 'POST',
                body: JSON.stringify({ procedure: name, input, query }),
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                    Accept: 'application/json,application/x-ndjson',
                    ...(options?.headers ?? {}),
                    ...this._authenticationHeaders(options),
                },
            }
        );

        if (
            response.headers
                ?.get('Content-Type')
                ?.indexOf('application/x-ndjson') >= 0
        ) {
            return streamJsonLines(response.body, new TextDecoder());
        } else {
            return await response.json();
        }
    }

    private _authenticationHeaders(
        options: CallProcedureOptions | undefined | null
    ): Record<string, string> {
        const key = options?.sessionKey ?? this._sessionKey;
        if (key) {
            return {
                Authorization: `Bearer ${key}`,
            };
        } else {
            return {};
        }
    }
}

/**
 * Creates a new records client with the given endpoint.
 * @param endpoint The endpoint that the client should use.
 * @returns
 */
export function createRecordsClient(
    endpoint: string
): RecordsClient & RecordsClientType {
    const client = new RecordsClient(endpoint);
    return new Proxy(client as RecordsClient & RecordsClientType, {
        get(target, prop, reciever) {
            if (prop in reciever || Object.hasOwn(reciever, prop)) {
                return Reflect.get(target, prop, reciever);
            } else if (typeof prop === 'string') {
                return async function (
                    arg: any,
                    options?: CallProcedureOptions
                ) {
                    return target.callProcedure(prop as string, arg, options);
                };
            }
            return Reflect.get(target, prop, reciever);
        },
    });
}

/**
 * Parses the given stream and produces a sequence of JSON objects.
 * The stream should be in the [application/x-ndjson format](https://github.com/ndjson/ndjson-spec).
 * @param reader The reader to read from.
 * @param decoder The decoder to use to decode the stream into text.
 */
export async function* streamJsonLines(
    stream: ReadableStream,
    decoder: TextDecoder
): AsyncGenerator<any> {
    let buffer = '';
    const reader = stream.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            if (buffer.length > 0) {
                return JSON.parse(buffer);
            }
            break;
        }

        let chunk = decoder.decode(value, { stream: true });

        let newlinePosition: number;
        while ((newlinePosition = chunk.indexOf('\n')) >= 0) {
            let carriageReturnPosition = chunk.indexOf(
                '\r',
                newlinePosition - 1
            );

            if (carriageReturnPosition >= 0) {
                const beforeCarriageReturn = chunk.substring(
                    0,
                    carriageReturnPosition
                );
                if (buffer.length + beforeCarriageReturn.length > 0) {
                    const jsonLine = buffer + beforeCarriageReturn;

                    yield JSON.parse(jsonLine);
                }

                const afterNewline = chunk.substring(
                    carriageReturnPosition + 2
                );
                chunk = afterNewline;
                buffer = '';
            } else {
                const beforeNewline = chunk.substring(0, newlinePosition);
                if (buffer.length + beforeNewline.length > 0) {
                    const jsonLine = buffer + beforeNewline;
                    yield JSON.parse(jsonLine);
                }

                const afterNewline = chunk.substring(newlinePosition + 1);
                chunk = afterNewline;
                buffer = '';
            }
        }

        buffer += chunk;
    }
}
