import type {
    CallProcedureOptions,
    Procedure,
    ProcedureInputs,
    RemoteProcedures,
} from '@casual-simulation/aux-common';
import type { RecordsServer } from './RecordsServer';
import axios from 'axios';

export type RecordsClientType = RemoteProcedures<RecordsServer['procedures']>;
export type RecordsClientInputs = ProcedureInputs<RecordsServer['procedures']>;

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

    constructor(endpoint: string) {
        this._endpoint = endpoint;
        this._sessionKey = null;
    }

    /**
     * Calls the procedure with the given name, using the given argument.
     * @param name The name of the procedure to call.
     * @param input The input to the procedure.
     * @param options The options to use for the procedure.
     */
    async callProcedure(
        name: string,
        input: any,
        options?: CallProcedureOptions
    ): Promise<any> {
        const response = await axios.post(
            `${options?.endpoint ?? this._endpoint}/api/v3/callProcedure`,
            { procedure: name, input },
            {
                headers: this._authenticationHeaders(options),
                validateStatus: () => true,
            }
        );

        return response.data;
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
