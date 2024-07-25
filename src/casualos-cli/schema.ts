import prompts from 'prompts';
import repl from 'node:repl';
import type {
    ArraySchemaMetadata,
    DiscriminatedUnionSchemaMetadata,
    EnumSchemaMetadata,
    ObjectSchemaMetadata,
    RecordSchemaMetadata,
    SchemaMetadata,
    UnionSchemaMetadata,
} from '../aux-common';

export interface PromptState {
    aborted: boolean;
}

export function onState(state: PromptState) {
    if (state.aborted) {
        process.nextTick(() => {
            process.exit(1);
        });
    }
}

export async function askForInputs(
    inputs: SchemaMetadata,
    name: string,
    repl: repl.REPLServer = null
): Promise<any> {
    if (inputs) {
        if (inputs.type === 'object') {
            return await askForObjectInputs(inputs, name, repl);
        } else if (inputs.type === 'string') {
            const response = await prompts({
                type: 'text',
                name: 'value',
                message: `Enter a value for ${name}.`,
                initial: inputs.defaultValue ?? undefined,
                onState,
            });

            return evalResult(response.value || undefined, repl, String);
        } else if (inputs.type === 'number') {
            const response = await prompts({
                type: repl ? 'text' : 'number',
                name: 'value',
                message: `Enter a number for ${name}.`,
                initial: inputs.defaultValue ?? undefined,
                onState,
            });

            return typeof response.value === 'number'
                ? response.value
                : typeof response.value === 'string'
                ? await evalResult(response.value || undefined, repl, Number)
                : undefined;
        } else if (inputs.type === 'boolean') {
            const response = await prompts({
                type: repl ? 'text' : 'toggle',
                name: 'value',
                message: `Enable ${name}?`,
                initial: inputs.defaultValue ?? undefined,
                active: 'yes',
                inactive: 'no',
                onState,
            });

            return typeof response.value === 'boolean'
                ? response.value
                : typeof response.value === 'string'
                ? await evalResult(response.value || undefined, repl, Boolean)
                : undefined;
        } else if (inputs.type === 'date') {
            const response = await prompts({
                type: repl ? 'text' : 'date',
                name: 'value',
                message: `Enter a date for ${name}.`,
                initial: inputs.defaultValue ?? undefined,
                onState,
            });

            return response.value instanceof Date
                ? response.value
                : typeof response.value === 'string'
                ? await evalResult(response.value || undefined, repl, Date)
                : undefined;
        } else if (inputs.type === 'literal') {
            return inputs.value;
        } else if (inputs.type === 'null') {
            return null;
        } else if (inputs.type === 'array') {
            return await askForArrayInputs(inputs, name, repl);
        } else if (inputs.type === 'enum') {
            return await askForEnumInputs(inputs, name, repl);
        } else if (inputs.type === 'union') {
            return await askForUnionInputs(inputs, name, repl);
        } else if (inputs.type === 'record') {
            return await askForRecordInputs(inputs, name, repl);
        } else if (inputs.type === 'any') {
            return await askForAnyInputs(name, repl);
        }
    }

    return undefined;
}

async function evalResult(
    result: any,
    repl: repl.REPLServer,
    type: any
): Promise<any> {
    if (typeof result === 'string' && repl && result.startsWith('.')) {
        const script = result.slice(1);
        if (script.startsWith('.')) {
            // Scripts can be escaped with a double dot.
            return script;
        }

        const promise = new Promise((resolve, reject) => {
            repl.eval(result.slice(1), repl.context, 'repl', (err, value) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(value);
            });
        });

        const value = await promise;
        return value;
    }

    if (type && result !== undefined && result !== null && result !== '') {
        return type(result);
    }

    return result;
}

async function askForObjectInputs(
    inputs: ObjectSchemaMetadata,
    name: string,
    repl: repl.REPLServer
): Promise<any> {
    const allowed = await askForOptionalInputs(inputs, name, repl);
    if (!allowed) {
        return inputs.defaultValue;
    }

    const result: any = {};
    for (let key in inputs.schema) {
        const prop = inputs.schema[key];
        const value = await askForInputs(prop, `${name}.${key}`, repl);
        result[key] = value;
    }
    return result;
}

async function askForArrayInputs(
    inputs: ArraySchemaMetadata,
    name: string,
    repl: repl.REPLServer
): Promise<any[]> {
    const allowed = await askForOptionalInputs(inputs, name, repl);
    if (!allowed) {
        return inputs.defaultValue;
    }

    const result: any[] = [];

    let length = 0;
    if (typeof inputs.exactLength === 'number') {
        length = inputs.exactLength;
    } else {
        const response = await prompts({
            type: 'number',
            name: 'length',
            message: `Enter the length of the array for ${name}.`,
            min: inputs.minLength ?? undefined,
            max: inputs.maxLength ?? undefined,
            onState,
        });
        length = response.length;
    }

    for (let i = 0; i < length; i++) {
        const value = await askForInputs(inputs.schema, `${name}[${i}]`, repl);
        result.push(value);
    }

    return result;
}

async function askForEnumInputs(
    inputs: EnumSchemaMetadata,
    name: string,
    repl: repl.REPLServer
): Promise<any> {
    let choices = inputs.values.map((value) => ({
        title: value,
        value: value,
    }));
    if (inputs.nullable) {
        choices = [
            {
                title: '(null)',
                value: '',
            },
            ...choices,
        ];
    }
    if (inputs.optional) {
        choices = [
            {
                title: '(undefined)',
                value: '',
            },
            ...choices,
        ];
    }
    const response = await prompts({
        type: 'select',
        name: 'value',
        message: `Select a value for ${name}.`,
        choices: choices,
        onState,
    });

    if (response.value === '') {
        if (inputs.nullable) {
            return null;
        } else {
            return undefined;
        }
    }

    return response.value;
}

async function askForUnionInputs(
    inputs: UnionSchemaMetadata,
    name: string,
    repl: repl.REPLServer
): Promise<any> {
    if ('discriminator' in inputs) {
        return await askForDiscriminatedUnionInputs(
            inputs as DiscriminatedUnionSchemaMetadata,
            name,
            repl
        );
    } else {
        const kind = await prompts({
            type: 'select',
            name: 'kind',
            message: `Select a kind for ${name}.`,
            choices: inputs.options.map((option) => {
                if (option.type === 'literal') {
                    return {
                        title: `(${option.value})`,
                        description: option.description,
                        value: option,
                    };
                } else if (option.type === 'null') {
                    return {
                        title: `(null)`,
                        description: option.description,
                        value: null,
                    };
                }

                return {
                    title: option.type,
                    description: option.description,
                    value: option,
                };
            }),
            onState,
        });

        return await askForInputs(kind.kind, name, repl);
    }
}

async function askForRecordInputs(
    inputs: RecordSchemaMetadata,
    name: string,
    repl: repl.REPLServer
): Promise<any> {
    const allowed = await askForOptionalInputs(inputs, name, repl);
    if (!allowed) {
        return inputs.defaultValue;
    }

    const result: any = {};

    while (true) {
        let key = await prompts({
            type: 'text',
            name: 'key',
            message: `Enter a property name for ${name}.`,
        });

        if (!key.key) {
            break;
        }

        const prop = inputs.valueSchema;
        const value = await askForInputs(prop, `${name}.${key.key}`, repl);
        result[key.key] = value;
    }

    return result;
}

async function askForDiscriminatedUnionInputs(
    inputs: DiscriminatedUnionSchemaMetadata,
    name: string,
    repl: repl.REPLServer
): Promise<any> {
    const kind = await prompts({
        type: 'select',
        name: 'kind',
        message: `Select a ${inputs.discriminator} for ${name}.`,
        choices: inputs.options.map((option) => {
            const prop = option.schema[inputs.discriminator];
            if (prop.type !== 'literal') {
                return {
                    title: option.type,
                    description: option.description,
                    value: option,
                };
            }

            return {
                title: prop.value,
                description: option.description,
                value: option,
            };
        }),
        onState,
    });

    return await askForInputs(kind.kind, name, repl);
}

async function askForAnyInputs(
    name: string,
    repl: repl.REPLServer
): Promise<any> {
    const kind = await prompts({
        type: 'select',
        name: 'kind',
        message: `Select a kind for ${name}.`,
        choices: [
            {
                title: 'json',
                description: 'A JSON value.',
                value: 'json',
            },
            {
                title: 'string',
                description: 'A string value.',
                value: 'string',
            },
            {
                title: 'number',
                description: 'A number value.',
                value: 'number',
            },
            {
                title: 'boolean',
                description: 'A boolean value.',
                value: 'boolean',
            },
            {
                title: '(null)',
                description: 'A null value.',
                value: 'null',
            },
        ],
        onState,
    });

    if (kind.kind === 'null') {
        return null;
    } else if (kind.kind === 'json') {
        while (true) {
            try {
                const response = await prompts({
                    type: 'text',
                    name: 'value',
                    message: `Enter a JSON value for ${name}.`,
                    onState,
                });

                if (response.value === '' || response.value === undefined) {
                    return undefined;
                }

                const script = response.value;
                if (typeof script === 'string' && script.startsWith('.')) {
                    return await evalResult(script, repl, null);
                }

                return JSON.parse(response.value);
            } catch (err) {
                console.log('Invalid JSON value.', err);
            }
        }
    }

    return await askForInputs(
        {
            type: kind.kind,
            nullable: true,
            optional: true,
        },
        name,
        repl
    );
}

async function askForOptionalInputs(
    inputs: SchemaMetadata,
    name: string,
    repl: repl.REPLServer
): Promise<true | undefined | null> {
    if (inputs.optional || inputs.nullable) {
        const response = await prompts({
            type: 'confirm',
            name: 'continue',
            message: `Do you want to enter a value for ${name}?`,
            onState,
        });

        if (!response.continue) {
            if (inputs.nullable) {
                return null;
            } else {
                return undefined;
            }
        }
    }

    return true;
}
