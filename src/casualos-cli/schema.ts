import prompts from 'prompts';
import type {
    ArraySchemaMetadata,
    DiscriminatedUnionSchemaMetadata,
    EnumSchemaMetadata,
    ObjectSchemaMetadata,
    SchemaMetadata,
    UnionSchemaMetadata,
} from '../aux-common';

export async function askForInputs(
    inputs: SchemaMetadata,
    name: string
): Promise<any> {
    if (inputs) {
        if (inputs.type === 'object') {
            return await askForObjectInputs(inputs, name);
        } else if (inputs.type === 'string') {
            const response = await prompts({
                type: 'text',
                name: 'value',
                message: `Enter a value for ${name}.`,
                initial: inputs.defaultValue ?? undefined,
            });

            return response.value || undefined;
        } else if (inputs.type === 'number') {
            const response = await prompts({
                type: 'number',
                name: 'value',
                message: `Enter a number for ${name}.`,
                initial: inputs.defaultValue ?? undefined,
            });

            return typeof response.value === 'number'
                ? response.value
                : undefined;
        } else if (inputs.type === 'boolean') {
            const response = await prompts({
                type: 'toggle',
                name: 'value',
                message: `Enable ${name}?`,
                initial: inputs.defaultValue ?? undefined,
                active: 'yes',
                inactive: 'no',
            });

            return typeof response.value === 'boolean'
                ? response.value
                : undefined;
        } else if (inputs.type === 'date') {
            const response = await prompts({
                type: 'date',
                name: 'value',
                message: `Enter a date for ${name}.`,
                initial: inputs.defaultValue ?? undefined,
            });

            return response.value || undefined;
        } else if (inputs.type === 'literal') {
            return inputs.value;
        } else if (inputs.type === 'null') {
            return null;
        } else if (inputs.type === 'array') {
            return await askForArrayInputs(inputs, name);
        } else if (inputs.type === 'enum') {
            return await askForEnumInputs(inputs, name);
        } else if (inputs.type === 'union') {
            return await askForUnionInputs(inputs, name);
        } else if (inputs.type === 'any') {
            return await askForAnyInputs(name);
        }
    }

    return undefined;
}

async function askForObjectInputs(
    inputs: ObjectSchemaMetadata,
    name: string
): Promise<any> {
    const result: any = {};
    for (let key in inputs.schema) {
        const prop = inputs.schema[key];
        const value = await askForInputs(prop, `${name}.${key}`);
        result[key] = value;
    }
    return result;
}

async function askForArrayInputs(
    inputs: ArraySchemaMetadata,
    name: string
): Promise<any[]> {
    const result: any[] = [];

    if (inputs.optional || inputs.nullable) {
        const response = await prompts({
            type: 'confirm',
            name: 'continue',
            message: `Do you want to enter an array for ${name}?`,
        });

        if (!response.continue) {
            if (inputs.nullable) {
                return null;
            } else {
                return undefined;
            }
        }
    }

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
        });
        length = response.length;
    }

    for (let i = 0; i < length; i++) {
        const value = await askForInputs(inputs.schema, `${name}[${i}]`);
        result.push(value);
    }

    return result;
}

async function askForEnumInputs(
    inputs: EnumSchemaMetadata,
    name: string
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
    name: string
): Promise<any> {
    if ('discriminator' in inputs) {
        return await askForDiscriminatedUnionInputs(
            inputs as DiscriminatedUnionSchemaMetadata,
            name
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
                        value: option.value,
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
        });

        return await askForInputs(kind.kind, name);
    }
}

async function askForDiscriminatedUnionInputs(
    inputs: DiscriminatedUnionSchemaMetadata,
    name: string
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
    });

    return await askForInputs(kind.kind, name);
}

async function askForAnyInputs(name: string): Promise<any> {
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
                });

                if (response.value === '' || response.value === undefined) {
                    return undefined;
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
        name
    );
}
