# @casual-simulation/aux-runtime

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/aux-runtime.svg)](https://www.npmjs.com/package/@casual-simulation/aux-runtime)

Runtime execution engine for CasualOS. This package provides the infrastructure to compile, execute, and supervise user scripts (bot tags) with full JavaScript support, rich APIs, and performance management.

## Overview

`aux-runtime` is the core execution engine that powers CasualOS user scripts:

-   **AuxRuntime**: Main runtime orchestrator that manages bot lifecycle and script execution
-   **AuxCompiler**: JavaScript/TypeScript compiler with source maps and debugging support
-   **Transpiler**: Code transformation engine with macro support and version tracking
-   **AuxLibrary**: 500+ built-in APIs available to user scripts (actions, queries, utilities)
-   **RuntimeBot**: Proxy wrapper for bot objects with change tracking and tag masking
-   **AuxGlobalContext**: Execution context management with energy limiting and async control
-   **RuntimeStateVersion**: State version tracking for real-time collaboration
-   **CompiledBot**: Compiled script cache with breakpoint support

## Installation

```bash
npm install @casual-simulation/aux-runtime
```

## Core Components

### AuxRuntime

The main runtime orchestrator that manages bot state, script compilation, and event execution.

**Key Features**:

-   Bot lifecycle management (add, update, remove)
-   Script compilation and caching
-   Event dispatching (shouts, whispers, actions)
-   Listener registration and execution
-   Energy management to prevent infinite loops
-   Tag masking and bot spaces
-   Module system support (ES6 imports/exports)
-   Real-time edit mode for collaborative editing
-   Error handling and stack trace mapping

**Configuration**:

```typescript
import {
    AuxRuntime,
    MemoryGlobalContext,
} from '@casual-simulation/aux-runtime';

const runtime = new AuxRuntime(
    {
        hash: 'v1.0.0',
        version: '1.0.0',
        major: 1,
        minor: 0,
        patch: 0,
    },
    {
        supportsAR: false,
        supportsVR: false,
        isCollaborative: true,
        ab1BootstrapUrl: 'https://bootstrap.example.com',
    }
);

// Initialize with bot state
await runtime.stateUpdated({
    state: {
        bot1: createBot('bot1', {
            name: 'My Bot',
            onClick: '@os.toast("Clicked!");',
        }),
    },
    addedBots: ['bot1'],
    updatedBots: [],
    removedBots: [],
});
```

**Example Usage**:

```typescript
// Execute a shout
const results = await runtime.shout('onClick', { botId: 'bot1' });

for (const result of results) {
    if (result.type === 'action') {
        console.log('Action:', result.action);
    }
}

// Execute a formula
const value = await runtime.execute('return 1 + 1;');
console.log('Result:', value); // 2

// Subscribe to actions
runtime.onActions.subscribe((actions) => {
    for (const action of actions) {
        if (action.type === 'show_toast') {
            console.log('Toast:', action.message);
        }
    }
});

// Subscribe to errors
runtime.onErrors.subscribe((errors) => {
    for (const error of errors) {
        console.error('Script error:', error.error, error.bot, error.tag);
    }
});
```

**Key Methods**:

-   `stateUpdated(event)`: Update bot state
-   `shout(name, arg?)`: Broadcast event to all listening bots
-   `whisper(bots, name, arg?)`: Send event to specific bots
-   `execute(script)`: Execute arbitrary JavaScript code
-   `context.recordBotState(bot)`: Record bot for change tracking
-   `context.getBotState(bot)`: Get bot state with changes
-   `context.enqueueAction(action)`: Queue an action for dispatch

### AuxCompiler

JavaScript/TypeScript compiler that transforms user scripts into executable functions.

**Key Features**:

-   Compiles scripts and formulas to JavaScript functions
-   Source map generation for error stack traces
-   Interpretable function wrapping for step-through execution
-   Module compilation (ES6 imports/exports)
-   TypeScript syntax support
-   Energy check injection for infinite loop detection
-   JSX/TSX support

**Configuration**:

```typescript
import { AuxCompiler } from '@casual-simulation/aux-runtime';

const compiler = new AuxCompiler();
```

**Example Usage**:

```typescript
// Simple script compilation
const func = compiler.compile('return 1 + 2');
const result = func();
console.log(result); // 3

// Compile with variables
const func2 = compiler.compile('return num1 + num2', {
    variables: {
        num1: () => 10,
        num2: () => 5,
    },
});
console.log(func2()); // 15

// Compile with constants
const func3 = compiler.compile('return num;', {
    constants: {
        num: -5,
    },
});
console.log(func3()); // -5

// Compile with before/after hooks
const context = { num: 0 };
const func4 = compiler.compile('return num', {
    variables: {
        num: (ctx: any) => ctx.num,
    },
    before: (ctx: any) => (ctx.num += 1),
    context,
});
console.log(func4()); // 1
console.log(func4()); // 2

// Compile listener script (with @ prefix)
const func5 = compiler.compile('@return 1 + 2');
console.log(func5()); // 3

// Compile with interpreter for debugging
import { Interpreter } from '@casual-simulation/js-interpreter';
const interpreter = new Interpreter();
const func6 = compiler.compile('return 1 + 2', {
    interpreter,
});
// func6 now has an interpretable version for step-through debugging

// Compile JSX
const funcJsx = compiler.compile('return <div></div>', {
    variables: {
        html: () => ({
            h: (type, props, ...children) => ({ type, props, children }),
        }),
    },
});
```

### Transpiler

Code transformation engine that processes JavaScript/TypeScript source code with energy checks and JSX support.

**Key Features**:

-   AST parsing using Acorn
-   Code generation using Astring
-   Source map generation and mapping
-   Infinite loop detection (injects `__energyCheck()` calls)
-   Version vector tracking for Yjs integration
-   TypeScript type stripping
-   JSX/TSX support with configurable factories

**Configuration**:

```typescript
import { Transpiler } from '@casual-simulation/aux-runtime';

// Basic transpiler
const transpiler = new Transpiler();

// With JSX support
const transpilerJsx = new Transpiler({
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
});
```

**Example Usage**:

```typescript
// Add energy checks to while loops
const result1 = transpiler.transpile('while(true) { console.log("Hello"); }');
console.log(result1);
// Output: 'while(true) {__energyCheck(); console.log("Hello"); }'

// Add energy checks to for loops
const result2 = transpiler.transpile(
    'for(let i = 1; i > 0; i++) { console.log("Hello"); }'
);
console.log(result2);
// Output: 'for(let i = 1; i > 0; i++) {__energyCheck(); console.log("Hello"); }'

// Transpile JSX
const transpilerJsx = new Transpiler({
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
});
const result3 = transpilerJsx.transpile('<div>Hello</div>');
console.log(result3);
// Output: 'h("div",null,`Hello`,)'

// Transpile JSX with attributes
const result4 = transpilerJsx.transpile(
    '<div val="123" other="str">Hello</div>'
);
console.log(result4);
// Output: 'h("div",{ "val":"123" ,"other":"str"},`Hello`,)'

// Transpile nested JSX
const result5 = transpilerJsx.transpile('<div><h1>Hello, World!</h1></div>');
console.log(result5);
// Output: 'h("div",null,h("h1",null,`Hello, World!`,),)'

// Calculate original location from transpiled code
import { calculateOriginalLineLocation } from '@casual-simulation/aux-runtime';
const result6 = transpiler.transpile('while(true) { break; }');
const originalLoc = calculateOriginalLineLocation(result6.metadata, {
    lineNumber: 1,
    column: 30,
});
```

### AuxLibrary

Comprehensive library of 500+ built-in APIs available to user scripts.

**API Categories**:

-   **Bot Operations**: `create()`, `destroy()`, `getBots()`, `getTag()`, `setTag()`
-   **Actions**: `os.toast()`, `os.showInput()`, `os.openURL()`
-   **Events**: `shout()`, `whisper()`, `superShout()`
-   **Queries**: `getBot()`, `getBotTagValues()`, `byTag()`
-   **Math**: `math.sum()`, `math.avg()`, `math.intersect()`
-   **Utilities**: `os.toast()`, `os.showJoinCode()`, `os.download()`
-   **Web**: `web.get()`, `web.post()`, `web.hook()`
-   **Crypto**: `crypto.encrypt()`, `crypto.decrypt()`, `crypto.hash()`
-   **AI**: `ai.chat()`, `ai.generateImage()`, `ai.generateSkybox()`
-   **Records**: `records.data.get()`, `records.file.upload()`
-   **Time**: `DateTime`, `Duration`, timezone functions
-   **Animation**: `animateTag()`, `clearAnimations()`

**Configuration**:

```typescript
import {
    createDefaultLibrary,
    MemoryGlobalContext,
} from '@casual-simulation/aux-runtime';

const library = createDefaultLibrary(context);
```

**Example APIs**:

```typescript
// Bot operations
const bot = create({ name: 'Player', color: '#ff0000' });
destroy(bot);
setTag(bot, 'score', 100);

// Player interactions
os.toast('Hello!');
const input = await os.showInput('Enter name:');
os.openURL('https://example.com');

// Events
shout('onClick');
whisper(bot, 'onTap');

// Queries
const bots = getBots(byTag('color', '#ff0000'));
const names = getBotTagValues('name');

// Math
const total = math.sum([1, 2, 3, 4]); // 10
const point = math.intersectPlane({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });

// Web requests
const response = await web.get('https://api.example.com/data');
```

See the [API documentation](https://docs.casualos.com/docs/actions) for the complete list.

### RuntimeBot

Proxy wrapper for bot objects that enables change tracking, tag masking, and dynamic listeners.

**Key Features**:

-   Transparent proxy over bot objects
-   Tag change tracking and diffing
-   Tag masking (tempLocal, local, remoteTempShared)
-   Bot space support
-   Dynamic listener registration
-   Script tag detection
-   Link resolution
-   Real-time edit mode

**Example Usage**:

```typescript
import { createRuntimeBot } from '@casual-simulation/aux-runtime';

const runtimeBot = createRuntimeBot(bot, manager);

// Access tags
console.log(runtimeBot.tags.name);

// Modify tags (tracked)
runtimeBot.tags.color = '#00ff00';

// Get changes
const changes = runtimeBot[CLEAR_CHANGES_SYMBOL]();
console.log(changes); // { color: '#00ff00' }

// Tag masking
runtimeBot[SET_TAG_MASK_SYMBOL]('color', '#ff0000', 'tempLocal');
console.log(runtimeBot.tags.color); // '#ff0000' (masked value)

// Edit tags (operational transform)
runtimeBot[EDIT_TAG_SYMBOL]('description', [
    { type: 'insert', index: 0, text: 'Hello ' },
]);
```

### AuxGlobalContext

Execution context that provides energy management, async task control, and API access.

**Key Features**:

-   Energy limiting to prevent infinite loops
-   Async task queuing (setTimeout, setInterval, promises)
-   Action queuing for event dispatch
-   Bot state tracking and versioning
-   Tag-specific APIs based on context
-   Debugger integration
-   Performance monitoring

**Example Usage**:

```typescript
const context = runtime.context;

// Energy management
context.energy = 50;
// ... execute code ...
console.log('Energy used:', 50 - context.energy);

// Queue actions
context.enqueueAction({
    type: 'show_toast',
    message: 'Hello!',
});

const actions = context.dequeueActions();

// Async tasks
const task = context.createTask();
task.resolve('abc');

// Bot manipulation
const b = context.createBot({
    id: 'test',
    tags: {
        abc: 'def',
    },
});
context.destroyBot(b);

// ... modify bot ...
const bot = context.bots[0];
bot.tags.abc = 'def';
```

### RuntimeStateVersion

State versioning for real-time collaboration using Yjs version vectors.

**Key Features**:

-   Yjs state vector integration
-   Relative position tracking
-   Version comparison
-   Cross-session synchronization

**Example Usage**:

```typescript
import { RuntimeStateVersion } from '@casual-simulation/aux-runtime';

const version = new RuntimeStateVersion(yjsDoc, { client1: 5, client2: 10 });

// Get current state vector
const stateVector = version.stateVector;

// Create relative position
const relPos = version.createRelativePosition(botId, tagName, 10);

// Restore absolute position
const absPos = version.restoreAbsolutePosition(relPos);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CasualOS Runtime                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │                 AuxRuntime                         │   │
│  │  (Orchestrates bot lifecycle and execution)        │   │
│  └────────┬───────────────────────────────────────────┘   │
│           │                                                 │
│  ┌────────▼───────────┐  ┌──────────────────────────┐    │
│  │   AuxCompiler      │  │   AuxGlobalContext       │    │
│  │                    │  │                          │    │
│  │ • Compile scripts  │  │ • Energy management      │    │
│  │ • Source maps      │  │ • Async tasks            │    │
│  │ • Breakpoints      │  │ • Action queuing         │    │
│  └────────┬───────────┘  └──────────┬───────────────┘    │
│           │                         │                      │
│  ┌────────▼───────────┐  ┌──────────▼───────────────┐    │
│  │    Transpiler      │  │     AuxLibrary           │    │
│  │                    │  │                          │    │
│  │ • AST parsing      │  │ • 500+ APIs              │    │
│  │ • Macro expansion  │  │ • Bot operations         │    │
│  │ • Version tracking │  │ • Actions & events       │    │
│  └────────────────────┘  └──────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │              RuntimeBot (Proxy)                    │   │
│  │                                                    │   │
│  │ • Change tracking   • Tag masking                 │   │
│  │ • Dynamic listeners • Real-time edits             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │           CompiledBot (Cache)                      │   │
│  │                                                    │   │
│  │ • Compiled scripts  • Breakpoints                 │   │
│  │ • Tag listeners     • Metadata                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Usage Examples

### Basic Runtime Setup

```typescript
import {
    AuxRuntime,
    MemoryGlobalContext,
    createDefaultLibrary,
} from '@casual-simulation/aux-runtime';
import { createBot } from '@casual-simulation/aux-common';

// Create runtime
const version = { hash: 'v1', version: '1.0.0', major: 1, minor: 0, patch: 0 };
const device = { supportsAR: false, supportsVR: false, isCollaborative: true };
const runtime = new AuxRuntime(version, device);

// Initialize with bots
await runtime.stateUpdated({
    state: {
        player1: createBot('player1', {
            name: 'Alice',
            onClick: '@os.toast("Hello!");',
        }),
        counter: createBot('counter', {
            count: 0,
            onClick: '@tags.count += 1; os.toast("Count: " + tags.count);',
        }),
    },
    addedBots: ['player1', 'counter'],
    updatedBots: [],
    removedBots: [],
});

// Execute events
await runtime.shout('onClick');
```

### Executing User Scripts

```typescript
// Execute inline script
const result = await runtime.execute(`
    const bot = create({ name: 'Dynamic Bot', color: '#00ff00' });
    return bot.id;
`);
console.log('Created bot:', result);

// Execute with energy limit
const context = runtime.context;
context.energy = 50;
try {
    await runtime.execute('while(true) {}'); // Infinite loop
} catch (err) {
    console.error('Ran out of energy:', err);
}
```

### Module System

```typescript
// Bot with module export
const libBot = createBot('lib', {
    system: 'lib',
    math: `📄
        export function add(a, b) { return a + b; }
        export function multiply(a, b) { return a * b; }
    `,
});

// Bot that imports module
const userBot = createBot('user', {
    onClick: `@
        import { add, multiply } from 'lib.math';
        const result = multiply(add(2, 3), 4);
        os.toast('Result: ' + result);
    `,
});

await runtime.stateUpdated({
    state: { lib: libBot, user: userBot },
    addedBots: ['lib', 'user'],
    updatedBots: [],
    removedBots: [],
});

await runtime.shout('onClick');
```

### Change Tracking

```typescript
import {
    createRuntimeBot,
    CLEAR_CHANGES_SYMBOL,
} from '@casual-simulation/aux-runtime';

const runtimeBot = createRuntimeBot(bot, factoryOptions);

// Modify bot
runtimeBot.tags.score = 100;
runtimeBot.tags.position = { x: 1, y: 2, z: 3 };

// Get changes
const changes = runtimeBot[CLEAR_CHANGES_SYMBOL]();
console.log(changes);
// { score: 100, position: { x: 1, y: 2, z: 3 } }

// Changes are now cleared
const noChanges = runtimeBot[CLEAR_CHANGES_SYMBOL]();
console.log(noChanges); // {}
```

## Runtime Goals

### 1. Full JavaScript Support

Supports all JavaScript features the underlying environment provides, including ES6+, async/await, generators, and modules.

### 2. System Stability

Prevents bad scripts from locking up the system through energy management, infinite loop detection, and graceful error handling.

### 3. Rich APIs

Provides 500+ built-in APIs for bot manipulation, UI interactions, web requests, cryptography, AI, and more.

### 4. Low Overhead

Pre-compiles scripts and caches compiled functions to minimize latency. Script execution is as simple as calling a function.

### 5. Great Developer Experience

Source maps enable accurate stack traces. Type definitions provide IntelliSense. Debugger support allows step-through execution.

## Dependencies

### Core Dependencies

-   `@casual-simulation/aux-common`: Common types and utilities
-   `@casual-simulation/aux-records`: Records system integration
-   `@casual-simulation/js-interpreter`: JavaScript interpreter for debugging
-   `@casual-simulation/engine262`: ECMAScript engine
-   `acorn`: JavaScript parser
-   `astring`: JavaScript code generator
-   `estraverse`: AST traversal
-   `lru-cache`: Compilation cache

### Utility Dependencies

-   `seedrandom`: Deterministic random number generation
-   `@tweenjs/tween.js`: Animation tweening
-   `uuid`: Unique identifier generation
-   `fast-json-stable-stringify`: Deterministic JSON serialization

## Testing

The module includes comprehensive test files:

-   `AuxRuntime.spec.ts`: Runtime orchestration tests
-   `AuxCompiler.spec.ts`: Compilation tests
-   `Transpiler.spec.ts`: Code transformation tests
-   `AuxLibrary.spec.ts`: API tests
-   `RuntimeBot.spec.ts`: Proxy wrapper tests
-   `AuxGlobalContext.spec.ts`: Context management tests

Run tests:

```bash
npm test
```

## License

AGPL-3.0-only

## Related Packages

-   `@casual-simulation/aux-common`: Core types and bot system
-   `@casual-simulation/aux-vm`: Virtual machine implementations
-   `@casual-simulation/aux-vm-browser`: Browser VM
-   `@casual-simulation/aux-vm-node`: Node.js VM
-   `@casual-simulation/aux-records`: Records system
-   `@casual-simulation/js-interpreter`: JavaScript interpreter

## Contributing

See [DEVELOPERS.md](../../DEVELOPERS.md) for development guidelines.

## Documentation

-   [API Documentation](https://docs.casualos.com/docs/actions)
-   [Runtime Architecture](runtime/README.md)
-   [Getting Started Guide](https://docs.casualos.com)

## Version

Current version: 3.8.1

See [CHANGELOG.md](../../CHANGELOG.md) for version history
