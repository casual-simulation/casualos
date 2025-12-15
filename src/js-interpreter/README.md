# @casual-simulation/js-interpreter

A sandboxed JavaScript interpreter built on top of [engine262](https://github.com/engine262/engine262), providing a secure execution environment for running untrusted JavaScript code with full ES6+ support, debugging capabilities, and controlled object marshalling between sandboxed and host environments.

## Overview

This package provides a complete JavaScript execution environment with isolation from the host environment, making it ideal for running user-provided code safely. It features step-by-step debugging, breakpoint support, and sophisticated object proxying to bridge sandboxed and host contexts.

## Main Exports

### `Interpreter`

A comprehensive JavaScript interpreter class that wraps engine262 capabilities with additional sandboxing, debugging, and object marshalling features.

**Features:**

-   **Full ES6+ Support**: Complete ECMAScript specification compliance via engine262
-   **Module System**: Create and execute ES6 modules with import/export support
-   **Debugging**: Step-through execution with breakpoint support
-   **Object Marshalling**: Bidirectional object proxying between sandboxed and host environments
-   **Generator-based Execution**: Pausable/resumable execution for async operations
-   **Symbol Mapping**: Automatic mapping of well-known symbols between contexts
-   **Job Queue Management**: Full async operation support

**Key Methods:**

-   `createAndLinkModule(code, moduleId)` - Create ES6 modules from code strings
-   `createFunction(name, code, ...params)` - Create callable functions in the sandbox
-   `callFunction(func, ...args)` - Execute sandboxed functions with host arguments
-   `runJobQueue()` - Process async operations (promises, timers, etc.)
-   `copyToValue(value)` - Convert host values to sandboxed values
-   `copyFromValue(value)` - Convert sandboxed values to host values
-   `proxyObject(obj)` - Create bidirectional object proxies

**Properties:**

-   `agent` - The engine262 Agent managing execution
-   `realm` - The isolated execution realm
-   `debugging` - Enable/disable step-by-step execution
-   `breakpoints` - Configured breakpoints for debugging

**Usage:**

```typescript
import { Interpreter, unwind } from '@casual-simulation/js-interpreter';

// Create interpreter instance
const interpreter = new Interpreter();

// Create a function in the sandbox
const func = interpreter.createFunction('add', 'return a + b;', 'a', 'b');

// Call the function
const result = unwind(interpreter.callFunction(func, 5, 3));
console.log(result); // 8

// Create and execute a module
const module = interpreter.createAndLinkModule(
    `
    export function multiply(x, y) {
        return x * y;
    }
    `,
    'mathModule'
);

// Enable debugging
interpreter.debugging = true;

// Set breakpoints
const breakpoint = {
    func,
    lineNumber: 1,
    columnNumber: 0,
    states: ['before', 'after'],
    disabled: false,
};
interpreter.breakpoints.push(breakpoint);

// Step through execution
const generator = interpreter.callFunction(func, 10, 20);
for (const step of generator) {
    console.log('Breakpoint hit:', step);
    // Continue execution by calling generator.next()
}
```

### `InterpreterUtils`

Utility functions for working with the interpreter, particularly for managing object marshalling and generator unwinding.

**Key Functions:**

#### `unwind<T>(generator): T`

Unwraps a generator by running it to completion and returning the final value. Essential for synchronous execution of interpreter operations.

```typescript
const result = unwind(interpreter.callFunction(func, arg1, arg2));
```

#### `unwindAndCapture<T, TReturn>(generator): { result: TReturn; states: T[] }`

Unwraps a generator while capturing all yielded intermediate states, useful for debugging.

```typescript
const { result, states } = unwindAndCapture(generator);
console.log('Execution steps:', states);
console.log('Final result:', result);
```

#### `isGenerator(value): boolean`

Type guard to check if a value is a generator object.

#### `isConstructor(func): boolean`

Determines if a function can be called as a constructor.

#### Object Marking Functions

-   `markWithInterpretedObject(value, obj)` - Mark host objects with their sandboxed equivalents
-   `markWithRegularObject(value, obj)` - Mark sandboxed objects with their host equivalents
-   `markAsProxyObject(value)` - Mark objects as proxy objects
-   `markAsUncopiableObject(value)` - Prevent automatic copying of objects

#### Symbol Constants

-   `INTERPRETER_OBJECT` - Symbol for storing sandboxed object references
-   `REGULAR_OBJECT` - Symbol for storing host object references
-   `IS_PROXY_OBJECT` - Symbol for marking proxy objects
-   `UNCOPIABLE` - Symbol for marking non-copyable objects

## Object Marshalling

The interpreter provides sophisticated marshalling between sandboxed and host environments:

### Copy vs. Proxy

**Copying** (via `copyToValue`/`copyFromValue`):

-   Primitives: strings, numbers, booleans, null, undefined
-   Simple objects and arrays (deep copy)
-   Functions become wrapped functions

**Proxying** (via `proxyObject`):

-   Complex objects that need live synchronization
-   Objects marked with special symbols
-   Error objects (to preserve stack traces)

### Bidirectional Communication

```typescript
// Host object available in sandbox
const hostObj = { value: 42 };
interpreter.proxyObject(hostObj);

// Changes in sandbox reflect in host
// Changes in host reflect in sandbox
```

## Debugging Features

### Breakpoints

Set breakpoints at specific locations with state control:

```typescript
const breakpoint = {
    func: constructedFunction,
    lineNumber: 5,
    columnNumber: 0,
    states: ['before', 'after'], // Break before and/or after execution
    disabled: false,
};
interpreter.breakpoints.push(breakpoint);
```

### Execution States

When a breakpoint is hit, you receive:

-   `state`: 'before' or 'after' the statement
-   `breakpoint`: The breakpoint that was hit
-   `node`: The AST node being executed
-   `stack`: Current execution context stack
-   `result`: (for 'after' state) The result of execution

## Use Cases

-   **Code Sandboxing**: Run untrusted user code safely
-   **Educational Tools**: Step-through execution for learning
-   **Plugin Systems**: Execute plugins in isolated environments
-   **Testing**: Controlled execution environments for tests
-   **Scripting Engines**: Embeddable scripting for applications

## Dependencies

-   **@casual-simulation/engine262**: ECMAScript specification implementation
-   **@casual-simulation/error-stack-parser**: Stack trace parsing for better error reporting
-   **@types/estree**: TypeScript types for ESTree AST nodes
-   **stackframe**: Stack frame manipulation utilities

## Installation

```bash
npm install @casual-simulation/js-interpreter
```

## Credits

Originally inspired by [NeilFraser/JS-Interpreter](https://github.com/NeilFraser/JS-Interpreter), rebuilt on engine262 for full ES6+ specification compliance.
