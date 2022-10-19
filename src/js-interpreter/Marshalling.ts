import {
    BooleanValue,
    Completion,
    Get,
    ObjectValue,
    Type,
    Value,
    Set,
    NormalCompletion,
    OrdinaryObjectCreate,
    EnsureCompletion,
    Construct,
    CreateBuiltinFunction,
    Call,
    Invoke,
    CreateArrayFromList,
} from '@casual-simulation/engine262';
import {
    ConvertedFromRegularObject,
    INTERPRETER_OBJECT,
    markWithInterpretedObject,
    markWithRegularObject,
    unwind,
} from './InterpreterUtils';
import { Interpreter } from './Interpreter';

export type TransformObjectFunc = (obj: object) => void;
export type CopyFromValueConstructor<T extends Value> = (
    val: T,
    proto: Object,
    interpreter: Interpreter,
    transformObject?: TransformObjectFunc
) => any;
export type CopyToValueConstructor<T> = (
    val: T,
    proto: Value,
    interpreter: Interpreter
) => Completion<Value>;
export type KnownPrototype = [
    interpreterPrototype: string,
    realPrototype: Object,
    copyToValue: CopyToValueConstructor<any>,
    CopyFromValueConstructor: CopyFromValueConstructor<Value>
];

const copyPropertiesFromObject = (
    source: ObjectValue,
    target: Object,
    interpreter: Interpreter,
    transformObject: TransformObjectFunc,
    disallowedProps: Set<string | symbol>
) => {
    for (let [prop, val] of source.properties.entries()) {
        let propName = interpreter.copyFromValue(prop);
        if (typeof propName !== 'string' && typeof propName !== 'symbol') {
            throw new Error(
                'Unable to copy properties with non string or symbol names!'
            );
        }

        if (disallowedProps && disallowedProps.has(propName)) {
            continue;
        }

        const propValue = unwind(Get(source, prop));

        if (propValue.Type !== 'normal') {
            throw new Error('An error occurred while getting a property.');
        }

        (target as any)[propName] = interpreter.copyFromValue(
            propValue.Value,
            transformObject
        );
    }

    if (transformObject) {
        transformObject(target);
    }

    Object.defineProperty(target, INTERPRETER_OBJECT, {
        value: source,
        enumerable: false,
        configurable: false,
        writable: false,
    });

    return target;
};

const copyPropertiesToObject = (
    source: Object,
    target: ObjectValue,
    interpreter: Interpreter,
    disallowedProps: Set<string | symbol>
) => {
    for (let prop of Object.getOwnPropertyNames(source)) {
        if (disallowedProps && disallowedProps.has(prop)) {
            continue;
        }

        let propNameResult = interpreter.copyToValue(prop);
        if (propNameResult.Type !== 'normal') {
            return propNameResult;
        }
        let propName = propNameResult.Value;
        if (Type(propName) !== 'String' && Type(propName) !== 'Symbol') {
            throw new Error(
                'Unable to copy properties with non string or symbol names!'
            );
        }

        const propValue = (source as any)[prop];

        const newValueResult = interpreter.copyToValue(propValue);

        if (newValueResult.Type !== 'normal') {
            return newValueResult;
        }

        unwind(Set(target, propName, newValueResult.Value, BooleanValue.true));
    }

    markWithRegularObject(target, source);

    return NormalCompletion(target);
};

const copyFromObjectFunc: (
    disallowedProps?: Set<string | symbol>
) => CopyFromValueConstructor<ObjectValue> = (disallowedProps) => {
    return (value, proto, interpreter, transformObject) => {
        const obj = Object.create(proto);
        copyPropertiesFromObject(
            value,
            obj,
            interpreter,
            transformObject,
            disallowedProps
        );
        return obj;
    };
};

const copyToObjectFunc: (
    disallowedProps?: Set<string | symbol>
) => CopyToValueConstructor<Object> = (disallowedProps) => {
    return (value, proto, interpreter) => {
        const obj = OrdinaryObjectCreate(proto, []);
        return copyPropertiesToObject(value, obj, interpreter, disallowedProps);
    };
};

const copyFromArrayFunc: (
    disallowedProps?: Set<string | symbol>
) => CopyFromValueConstructor<ObjectValue> = (disallowedProps) => {
    return (value, proto, interpreter, transformObject) => {
        const obj = new Array();
        copyPropertiesFromObject(
            value,
            obj,
            interpreter,
            transformObject,
            disallowedProps
        );
        return obj;
    };
};

const copyToArrayFunc: (
    disallowedProps?: Set<string | symbol>
) => CopyToValueConstructor<Array<any>> = (disallowedProps) => {
    return (value, proto, interpreter) => {
        const obj = CreateArrayFromList([]);
        return copyPropertiesToObject(value, obj, interpreter, disallowedProps);
    };
};

const copyFromError: CopyFromValueConstructor<ObjectValue> =
    copyFromObjectFunc();

const copyToErrorFunc: (intrinsic: string) => CopyToValueConstructor<Error> = (
    intrinsic
) => {
    return (err, proto, interpreter) => {
        const constructor = interpreter.realm.Intrinsics[intrinsic];
        const result = EnsureCompletion(
            unwind(Construct(constructor as ObjectValue, []))
        );
        if (result.Type !== 'normal') {
            return result;
        }
        const constructed = result.Value as ObjectValue;

        return copyPropertiesToObject(
            err,
            constructed,
            interpreter,
            new globalThis.Set(['stack'])
        );
    };
};

const copyFromPromise: CopyFromValueConstructor<Value> = (
    val,
    proto,
    interpreter
) => {
    return markWithInterpretedObject(
        new Promise((resolve, reject) => {
            const bResolve = CreateBuiltinFunction(
                (args: any[]) => {
                    const val = args[0];
                    resolve(interpreter.copyFromValue(val));
                    return Value.undefined;
                },
                1,
                new Value('resolve'),
                [],
                interpreter.realm
            );

            const bReject = CreateBuiltinFunction(
                (args: any[]) => {
                    const val = args[0];
                    reject(interpreter.copyFromValue(val));
                    return Value.undefined;
                },
                1,
                new Value('reject'),
                [],
                interpreter.realm
            );

            unwind(
                Invoke(val as ObjectValue, new Value('then'), [
                    bResolve,
                    bReject,
                ])
            );
        }),
        val
    );
};

const copyToPromise: CopyToValueConstructor<Promise<any>> = (
    val,
    proto,
    interpreter
) => {
    const executer = CreateBuiltinFunction(
        (args: any[]) => {
            const [resolve, reject] = args;

            val.then(
                (res) => {
                    let result = interpreter.copyToValue(res);
                    if (result.Type !== 'normal') {
                        unwind(Call(reject, Value.null, [result.Value]));
                    } else {
                        unwind(Call(resolve, Value.null, [result.Value]));
                    }
                },
                (err) => {
                    let result = interpreter.copyToValue(err);
                    unwind(Call(reject, Value.null, [result.Value]));
                }
            );
        },
        2,
        new Value('executer'),
        [],
        interpreter.realm
    );
    return EnsureCompletion<Value & ConvertedFromRegularObject>(
        markWithRegularObject(
            unwind(
                Construct(
                    interpreter.realm.Intrinsics['%Promise%'] as ObjectValue,
                    [executer]
                )
            ),
            val
        )
    );
};

const copyFromFunction: CopyFromValueConstructor<ObjectValue> = (
    val,
    proto,
    interpreter
) => {
    return interpreter.reverseProxyObject(val);
};
const copyToFunction: CopyToValueConstructor<Function> = (
    val,
    proto,
    interpreter
) => {
    return interpreter.proxyObject(val);
};

const errorPrototypes: KnownPrototype[] = [
    [
        '%Error.prototype%',
        Error.prototype,
        copyToErrorFunc('%Error%'),
        copyFromError,
    ],
    [
        '%EvalError.prototype%',
        EvalError.prototype,
        copyToErrorFunc('%EvalError%'),
        copyFromError,
    ],
    [
        '%RangeError.prototype%',
        RangeError.prototype,
        copyToErrorFunc('%RangeError%'),
        copyFromError,
    ],
    [
        '%ReferenceError.prototype%',
        ReferenceError.prototype,
        copyToErrorFunc('%ReferenceError%'),
        copyFromError,
    ],
    [
        '%SyntaxError.prototype%',
        SyntaxError.prototype,
        copyToErrorFunc('%SyntaxError%'),
        copyFromError,
    ],
    [
        '%TypeError.prototype%',
        TypeError.prototype,
        copyToErrorFunc('%SyntaxError%'),
        copyFromError,
    ],
    [
        '%URIError.prototype%',
        URIError.prototype,
        copyToErrorFunc('%URIError%'),
        copyFromError,
    ],
];

/**
 * The list of prototypes that can be copied.
 */
export const copyPrototypes: KnownPrototype[] = [
    [
        '%Object.prototype%',
        Object.prototype,
        copyToObjectFunc(),
        copyFromObjectFunc(),
    ],
    [
        '%Array.prototype%',
        Array.prototype,
        copyToArrayFunc(),
        copyFromArrayFunc(),
    ],
    [
        '%Function.prototype%',
        Function.prototype,
        copyToFunction,
        copyFromFunction,
    ],
    ['%Promise.prototype%', Promise.prototype, copyToPromise, copyFromPromise],
    ...errorPrototypes,
];

/**
 * The list of prototypes that have special behavior for being proxied.
 */
export const proxyPrototypes: KnownPrototype[] = [
    ['%Promise.prototype%', Promise.prototype, copyToPromise, copyFromPromise],
];
