/**
 * @license
 * Copyright 2013 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Acorn from 'acorn';
import internal from 'stream';

const PARSE_OPTIONS: Acorn.Options = {
    locations: true,
    ecmaVersion: 6,
};

/**
 * Create a new interpreter.
 * @param {string|!Object} code Raw JavaScript text or AST.
 * @param {Function=} opt_initFunc Optional initialization function.  Used to
 *     define APIs.  When called it is passed the interpreter object and the
 *     global scope object.
 * @constructor
 */
class Interpreter {
    private paused_: boolean;
    private polyfills_: any[];
    private functionCounter_: number;
    private stepFunctions_: { [key: string]: any };
    private setterStep_: any;

    ast: Acorn.Node;
    globalScope: Interpreter.Scope;
    globalObject: Interpreter.Obj;
    stateStack: Interpreter.State[];

    NUMBER: Interpreter.Obj;
    BOOLEAN: Interpreter.Obj;
    STRING: Interpreter.Obj;

    EVAL_ERROR: Interpreter.Obj;
    RANGE_ERROR: Interpreter.Obj;
    REFERENCE_ERROR: Interpreter.Obj;
    SYNTAX_ERROR: Interpreter.Obj;
    TYPE_ERROR: Interpreter.Obj;
    URI_ERROR: Interpreter.Obj;

    newNode() {
        return new Acorn.Node({ options: {} } as any, 0);
    }

    getScope() {
        let scope = this.stateStack[this.stateStack.length - 1].scope;
        if (!scope) {
            throw Error('No scope found');
        }
        return scope;
    }

    constructor(ast: Acorn.Node) {
        this.ast = ast;

        // Get a handle on Acorn's node_t object.
        // var nodeConstructor = code.constructor;

        // this.newNode = function () {
        //     return new nodeConstructor({ 'options': {} });
        // };
        // Clone the root 'Program' node so that the AST may be modified.
        // var ast = this.newNode();

        // for (var prop in code) {
        //     ast[prop] = (prop === 'body') ? code[prop].slice() : code[prop];
        // }

        this.ast = ast;

        // this.initFunc_ = opt_initFunc;
        this.paused_ = false;
        this.polyfills_ = [];

        // Unique identifier for native functions.  Used in serialization.
        this.functionCounter_ = 0;

        // Map node types to our step function names; a property lookup is faster
        // than string concatenation with "step" prefix.
        this.stepFunctions_ = Object.create(null);

        let stepMatch = /^step([A-Z]\w*)$/;
        let m;
        for (let methodName in this) {
            const method = this[methodName];
            if (
                typeof method === 'function' &&
                (m = methodName.match(stepMatch))
            ) {
                this.stepFunctions_[m[1]] = (this[methodName] as Function).bind(
                    this
                );
            }
        }

        // Create and initialize the global scope.
        this.globalScope = this.createScope(this.ast, null);
        this.globalObject = this.globalScope.object;

        // Run the polyfills.
        this.polyfills_ = undefined; // Allow polyfill strings to garbage collect.
        this.ast = this.parse_(this.polyfills_.join('\n'), 'polyfills');
        Interpreter.stripLocations_(this.ast, undefined, undefined);
        let state = new Interpreter.State(this.ast, this.globalScope);
        state.done = false;
        this.stateStack = [state];
        this.run();
        this.value = undefined;
        // Point at the main program.
        this.ast = ast;
        state = new Interpreter.State(this.ast, this.globalScope);
        state.done = false;
        this.stateStack.length = 0;
        this.stateStack[0] = state;
    }

    createScope(
        node: Acorn.Node,
        parentScope: Interpreter.Scope | null
    ): Interpreter.Scope {
        let strict = false;
        if (parentScope && parentScope.strict) {
            strict = true;
        } else {
            const anyNode = node as any;
            let firstNode = anyNode.body && anyNode.body[0];
            if (
                firstNode &&
                firstNode.expression &&
                firstNode.expression.type === 'Literal' &&
                firstNode.expression.value === 'use strict'
            ) {
                strict = true;
            }
        }

        let object = this.createObjectProto(null);
        let scope = new Interpreter.Scope(parentScope, strict, object);
        if (!parentScope) {
            this.initGlobal(scope.object);
        }
        this.populateScope_(node, scope);

        return scope;
    }

    /**
     * Initialize the global object with builtin properties and functions.
     * @param globalObject The global object.
     */
    initGlobal(globalObject: Interpreter.Obj): void {
        this.setProperty(globalObject, 'NaN', NaN, Interpreter.NON);
    }

    createObjectProto(proto: Interpreter.Obj | null): Interpreter.Obj {
        if (typeof proto !== 'object') {
            throw new Error('Non object prototype');
        }
        let obj = new Interpreter.Obj(proto);

        if (this.isa(obj, this.ERROR)) {
            obj.class = 'Error';
        }

        return obj;
    }

    /**
     * Create a new data object based on a constructor's prototype.
     * Returns the newly created data object.
     * @param constructor The parent constructor function, or null if scope object.
     */
    createObject(constructor: Interpreter.Obj | null) {
        return this.createObjectProto(
            constructor && constructor.properties['prototype']
        );
    }

    /**
     * Is an object of a certain class?
     * Returns true if the object is the class or inherits from it. False otherwise.
     * @param child The object to check.
     * @param constructor The constructor of the object.
     */
    isa(child: Interpreter.Value, constructor: Interpreter.Obj): boolean {
        if (child === null || child === undefined || !constructor) {
            return false;
        }
        let proto = constructor.properties['prototype'];
        if (child === proto) {
            return true;
        }

        child = this.getPrototype(child);
        while (child) {
            if (child === proto) {
                return true;
            }
            child = child.proto;
        }
        return false;
    }

    /**
     * Look up the prototype for this value.
     * Returns the prototype object. Null if the value does not have a prototype.
     * @param value The value.
     */
    getPrototype(value: Interpreter.Value): Interpreter.Obj {
        switch (typeof value) {
            case 'number':
                return this.NUMBER.properties['prototype'];
            case 'boolean':
                return this.BOOLEAN.properties['prototype'];
            case 'string':
                return this.STRING.properties['prototype'];
        }
        if (value) {
            return value.proto;
        }
        return null;
    }

    /**
     * Set a property value on a data object.
     * Returns a setter function if one needs to be called, otherwise undefined.
     * @param obj The object.
     * @param name The name of the property.
     * @param value The new property value. use Interpreter.VALUE_IN_DESCRIPTOR if value is handled by descriptor instead.
     * @param descriptor The descriptor object.
     */
    setProperty(
        obj: Interpreter.Value,
        name: Interpreter.Value,
        value: Interpreter.Value,
        descriptor?: Interpreter.ObjectMap | undefined
    ): Interpreter.Obj | undefined {
        if (this.setterStep_) {
            // Getter from previous call to setProperty was not handled.
            throw new Error('Setter no supported in that context');
        }

        name = String(name);
        if (obj === undefined || obj === null) {
            this.throwException(
                this.TYPE_ERROR,
                `Cannot set property '${name}' of ${obj}`
            );
        }
        if (typeof obj === 'object' && !(obj instanceof Interpreter.Obj)) {
            throw TypeError('Expecting native value or pseudo object');
        }
        if (
            descriptor &&
            ('get' in descriptor || 'set' in descriptor) &&
            ('value' in descriptor || 'writable' in descriptor)
        ) {
            this.throwException(
                this.TYPE_ERROR,
                `Invalid property descriptor. Cannot both specify accessors and a value or writable attribute`
            );
        }
        let strict = !this.stateStack || this.getScope().strict;
        if (!(obj instanceof Interpreter.Obj)) {
            if (strict) {
                this.throwException(
                    this.TYPE_ERROR,
                    `Can't create property '${name}' on '${obj}'`
                );
            }
            return;
        }

        if (this.isa(obj, this.STRING)) {
            let n = Interpreter.legalArrayIndex(name);
            if (name === 'length' || (!isNaN(n) && n < String(obj).length)) {
                // Can't set length or letters on String objects.
                if (strict) {
                    this.throwException(
                        this.TYPE_ERROR,
                        `Cannot assign to read only property '${name}' of String '${
                            (obj as Interpreter.Obj).data
                        }'`
                    );
                }
                return;
            }
        }

        if (obj.class === 'Array') {
            let len = obj.properties.length;
            let i: number;
            if (name === 'length') {
                if (descriptor) {
                    if (!('value' in descriptor)) {
                        return;
                    }
                    value = descriptor.value;
                }
                value = Interpreter.legalArrayLength(value);
                if (isNaN(value)) {
                    this.throwException(
                        this.RANGE_ERROR,
                        'Invalid array length'
                    );
                }
            }
        }
    }

    /**
     * Throw an exception in the interpreter that can be handled by an interpreter try/catch statement.
     * If unhandled, a real exception will be thrown. Can be called with either an error class and a message, or with an actual object to be thrown.
     * @param errorClass The type of error (if a message is provided) or the value to throw (if no message).
     * @param message The message being thrown.
     */
    throwException(errorClass: Interpreter.Obj, message?: string | undefined) {
        let error: any;
        if (message === undefined) {
            // This is a value to throw, not an error class.
            error = errorClass;
        } else {
            error = this.createObject(errorClass);
            this.populateError(error, message);
        }
        // TODO:
    }

    private parse_(code: string, sourceFile: string) {
        return Acorn.parse(code, {
            ...PARSE_OPTIONS,
            sourceFile: sourceFile,
        });
    }

    private static stripLocations_(
        node: Acorn.Node,
        start?: number,
        end?: number
    ) {
        if (typeof start === 'number') {
            node.start = start;
        } else {
            delete node.start;
        }
        if (typeof end === 'number') {
            node.end = end;
        } else {
            delete node.end;
        }

        for (let name in node) {
            if (name !== 'loc' && node.hasOwnProperty(name)) {
                let prop = (node as any)[name];
                if (prop && typeof prop === 'object') {
                    Interpreter.stripLocations_(prop, start, end);
                }
            }
        }
    }
}

namespace Interpreter {
    export type ObjectMap = { [key: string]: any };

    export type Value = Obj | boolean | number | string | undefined | null;

    export class State {
        node: Acorn.Node;
        scope: Scope;

        constructor(node: Acorn.Node, scope: Scope) {
            this.node = node;
            this.scope = scope;
        }
    }

    export class Scope {
        parentScope: Scope | null;
        strict: boolean;
        object: Obj;

        constructor(parentScope: Scope | null, strict: boolean, object: Obj) {
            this.parentScope = parentScope;
            this.strict = strict;
            this.object = object;
        }
    }

    export class Obj {
        getter: Object;
        setter: Object;
        properties: ObjectMap;
        proto: Obj = null;
        class: string = 'Object';
        data: any = null;

        constructor(proto: Obj) {
            this.getter = Object.create(null);
            this.setter = Object.create(null);
            this.properties = Object.create(null);
            this.proto = proto;
        }
    }

    /**
     * Is a value a legal integer for an array index?
     * Returns the value as zero or a positive integer if the value can be converted to such. NaN otherwise.
     * @param value The value to check.
     */
    export function legalArrayIndex(value: Value): number {
        let n = (value as any) >>> 0;
        // Array index cannot be 2^32-1, otherwise length would be 2^32.
        // 0xffffffff is 2^32-1.
        return String(n) === String(value) && n !== 0xffffffff ? n : NaN;
    }

    /**
     * Is a value a legal integer for an array length?
     * Returns the value as zero or a positive integer if the value can be converted to such. NaN otherwise.
     * @param value The value to check.
     */
    export function legalArrayLength(value: Value): number {
        var n = (value as any) >>> 0;
        // Array length must be between 0 and 2^32-1 (inclusive).
        return n === Number(value) ? n : NaN;
    }
}
