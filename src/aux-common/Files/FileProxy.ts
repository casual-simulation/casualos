import { File, FileTags } from './File';
import { FileCalculationContext, calculateFileValue, isFormula, isFile as isObjFile, calculateFormulaValue, calculateValue } from './FileCalculations';
import { cloneDeep, uniq } from 'lodash';

/**
 * The symbol that can be used to tell if an object represents a proxy.
 */
export const isProxy = Symbol('isProxy');

/**
 * The symbol that can be used to get the object that a proxy represents.
 */
export const proxyObject = Symbol('proxyObject');

/**
 * Defines an interface for a proxy object that is returned from FileProxy.
 */
export interface ProxyObject<T> {
    /**
     * Gets whether this object represents a proxy.
     */
    [isProxy]: boolean;

    /**
     * Gets the object that the proxy wraps.
     */
    [proxyObject]: T;
}

/**
 * Defines an interface for a file that is being proxied so that
 * formulas are transparently calculated and deep values can be handled transparently.
 */
export interface FileProxy extends ProxyObject<File>, FileTags  {
    /**
     * Gets the ID of the file.
     */
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
    return <FileProxy>new Proxy(file, _createProxyHandler(calc, file, cloneDeep(file.tags), setValue, true));
}

function _createProxyHandler(calc: FileCalculationContext, file: File, tags: any, setValue: SetValueHandler, isFile: boolean, props?: string, fullProps?: string[]): ProxyHandler<any> {
    return {
        ownKeys: function(target) {
            let props: (string | number | symbol)[] = isFile ? ['id'] : [];
            props.push(...Reflect.ownKeys(target));
            if (isFile) {
                props.push(...Reflect.ownKeys(tags));
            }
            return uniq(props);
        },
        getOwnPropertyDescriptor: function(target, prop) {
            let descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
            if (descriptor) {
                return descriptor;
            }
            return {
                enumerable: true,
                configurable: true,
                writable: true,
            };
        },
        has: function(target, prop) {
            return prop in tags;
        },
        get: function (target, property, receiver) {
            let descriptor = Reflect.getOwnPropertyDescriptor(target, property);
            if (descriptor && !descriptor.configurable) {
                return Reflect.get(target, property);
            }

            let nextTags = tags;
            let nextFullProps = fullProps;
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
                } else if (property === Symbol.toStringTag) {
                    if (target instanceof Number) {
                        return 'Number';
                    } else if (target instanceof Boolean) {
                        return 'Boolean';
                    } else if (target instanceof String) {
                        return 'String';
                    } else if (Array.isArray(target)) {
                        return 'Array';
                    }
                }
                
                return target[property];
            }

            if (property === 'constructor') {
                return target[property];
            }

            let nextProps: string = null;
            let nextFile: File = file;
            let val = target[property];
            let fromTag = false;
            if (typeof val === 'undefined') {
                nextProps = props ? `${props}.${property}` : property.toString();
                val = target[nextProps];
                if (typeof val === 'undefined') {
                    fromTag = true;
                    val = tags[nextProps];
                }
            }
            
            if (val) {
                isFile = isObjFile(val);
                if (isFile) {
                    nextFile = val;
                }
                if (fromTag) {
                    val = calculateValue(calc, file, nextProps || property.toString(), val, false);
                    if (val[isProxy]) {
                        return val;
                    }
                }
                
                if (typeof val === 'object') {
                    nextFullProps = nextFullProps ? nextFullProps.slice() : [];
                    nextFullProps.push(nextProps || property.toString());
                    nextProps = null;
                }
                
                val = isFile ? cloneDeep(val) : val;
                nextTags = isFile ? val.tags : 
                    typeof val === 'object' ? val :
                    tags;
            }

            if (nextFullProps && nextFullProps.length > 0 && nextFullProps[0] === 'id') {
                return val;
            }

            if (typeof val === 'boolean') {
                return new Proxy(new Boolean(val), _createProxyHandler(calc, nextFile, nextTags, setValue, isFile, nextProps, nextFullProps));
            } else if (typeof val === 'number') {
                return new Proxy(new Number(val), _createProxyHandler(calc, nextFile, nextTags, setValue, isFile, nextProps, nextFullProps));
            } else if (typeof val === 'string') {
                return new Proxy(new String(val), _createProxyHandler(calc, nextFile, nextTags, setValue, isFile, nextProps, nextFullProps));
            }


            return new Proxy(val || new String(''), _createProxyHandler(calc, nextFile, nextTags, setValue, isFile, nextProps, nextFullProps));
        },
        set: function(target, property, value, receiver) {
            if (!setValue) {
                return;
            }
            if (typeof property === 'symbol') {
                return;
            }
            
            let actualProp: string = props ? `${props}.${property}` : property.toString();
            // let settableProp = actualProp;
            // if (isFile) {
            //     settableProp = `tags.${settableProp}`;
            // }
            let fullProp: string = fullProps ? `${fullProps.join('.')}` : actualProp;

            const ret = Reflect.set(target, actualProp, value, tags);

            if (fullProp !== actualProp && !isFile) {
                setValue(fullProp, Object.assign({}, target));
            } else {
                setValue(actualProp, value);
            }

            return ret;
        },
        apply: function(target: Function, thisArg, args) {
            if (thisArg[isProxy]) {
                thisArg = thisArg[proxyObject];
            }

            return target.apply(thisArg, args);
        }
    };
}