# AUX Common

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/aux-common.svg)](https://www.npmjs.com/package/@casual-simulation/aux-common)

A library that contains common operations needed to modify and understand AUX files.

## Installation

```bash
$ npm install @casual-simulation/aux-common
```

## Usage

#### Calculate a formula for some bots

```typescript
import {
    createFile,
    createCalculationContext,
    calculateFormulaValue,
} from '@casual-simulation/aux-common';

const file1 = createFile('test1', {
    quantity: 10,
});
const file2 = createFile('test2', {
    quantity: 5,
});
const file3 = createFile('test3', {
    quantity: 5,
});

const context = createCalculationContext([file1, file2, file3]);

const formula = '=math.sum(getBotTagValues("#quantity"))';
const result = calculateFormulaValue(context, formula);

console.log(result);

// Outputs:
// 20
```

#### Calculate events for an action script

```typescript
import {
    createFile,
    createCalculationContext,
    calculateFormulaEvents,
} from '@casual-simulation/aux-common';

const state = {
    test1: createFile('test1', {
        quantity: 10,
    }),
    test2: createFile('test2', {
        quantity: 5,
    }),
    test3: createFile('test3', {
        quantity: 5,
    }),
};

const formula = `
    let total = math.sum(getBotTagValues("#quantity"));
    player.toast("The total is " + total);
`;
const events = calculateFormulaEvents(state, formula);

for (let event of events) {
    if (event.type === 'local') {
        if (event.name === 'show_toast') {
            console.log('[Toast]', event.message);
        }
    }
}

// Outputs:
// [Toast] The total is 5
```
