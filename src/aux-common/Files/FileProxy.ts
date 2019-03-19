import { File, FileTags } from './File';
import { FileCalculationContext } from './FileCalculations';

/**
 * The symbol that can be used to tell if an object represents a proxy.
 */
export const isProxy = Symbol('isProxy');

/**
 * The symbol that can be used to get the object that a proxy represents.
 */
export const proxyObject = Symbol('proxyObject');

/**
 * Defines an interface for a file that is being proxied so that
 * formulas are transparently calculated and deep values can be handled transparently.
 */
export interface FileProxy extends FileTags {
    [isProxy]: boolean;
    [proxyObject]: File;
    id: File['id'];
}

export type SetValueHandler = (tag: string, value: any) => any;

/**
 * Creates a new file proxy from the given file and calculation context.
 * @param calc The calculation context to use.
 * @param file The file.
 * @param setValue The function that should be called with a file event whenever a value is changed.
 */
export function createFileProxy(calc: FileCalculationContext, file: File, setValue: SetValueHandler = null): FileProxy {
    return <FileProxy>new Proxy(file, _createProxyHandler(calc, file.tags, setValue));
}

function _createProxyHandler(calc: FileCalculationContext, tags: any, setValue: SetValueHandler, props?: string, fullProps?: string): ProxyHandler<any> {
    return {
        ownKeys: function(target) {
            let props: (string | number | symbol)[] = ['id'];
            props.push(...Reflect.ownKeys(tags));
            return props;
        },
        getOwnPropertyDescriptor: function(target, prop) {
            return {
                enumerable: true,
                configurable: true,
                writable: true,
            };
        },
        has: function(target, prop) {
            return prop in tags;
        },
        get: function (target, property) {
            let nextTags = tags;
            if (typeof property === 'symbol') {
                if (property === isProxy) {
                    return true;
                } else if (property === proxyObject) {
                    if (target instanceof Number) {
                        return target.valueOf();
                    } else if (target instanceof Boolean) {
                        return target.valueOf();
                    } else if (target instanceof String) {
                        return target.valueOf();
                    } else {
                        return target;
                    }
                } else if (property === Symbol.toPrimitive) {
                    return function (hint: string) {
                        if (target instanceof Number) {
                            return target.valueOf();
                        } else if (target instanceof Boolean) {
                            return target.valueOf();
                        } else if (target instanceof String) {
                            return target.valueOf();
                        }
                    };
                }
                
                return target[property];
            }

            if (property === 'constructor') {
                return target[property];
            }

            let nextProps: string = null;
            let fullProps = props ? `${props}.${property}` : property.toString();
            let val = target[property];
            if (typeof val === 'undefined') {
                nextProps = props ? `${props}.${property}` : property.toString();
                val = target[nextProps];
                if (typeof val === 'undefined') {
                    val = tags[nextProps];
                }
            }
            
            if (val) {
                nextProps = null;
                nextTags = val;
            }

            if (typeof val === 'boolean') {
                return new Proxy(new Boolean(val), _createProxyHandler(calc, nextTags, setValue, nextProps, fullProps));
            } else if (typeof val === 'number') {
                return new Proxy(new Number(val), _createProxyHandler(calc, nextTags, setValue, nextProps, fullProps));
            } else if (typeof val === 'string') {
                return new Proxy(new String(val), _createProxyHandler(calc, nextTags, setValue, nextProps, fullProps));
            }

            return new Proxy(val || new String(''), _createProxyHandler(calc, nextTags, setValue, nextProps, fullProps));
        },
        set: function(target, property, value, receiver) {
            if (!setValue) {
                return;
            }
            if (typeof property === 'symbol') {
                return;
            }
            
            let fullProp: string = fullProps ? `${fullProps}.${property}` : property.toString();
            let actualProp: string = props ? `${props}.${property}` : property.toString();
            setValue(fullProp, value);

            return Reflect.set(target, actualProp, value, tags);
        },
        apply: function(target: Function, thisArg, args) {
            if (thisArg[isProxy]) {
                thisArg = thisArg[proxyObject];
            }

            return target.apply(thisArg, args);
        }
    };
}