# Bots

The core bot system module for CasualOS. This folder contains the fundamental types, calculations, actions, events, and utilities that define how bots work in CasualOS.

## Overview

Bots are the primary entity model in CasualOS - interactive objects that contain tags (properties) which can hold data or scripts. This module provides:

-   **Bot Types**: Core interfaces and types for representing bots (`RuntimeBot`, `Bot`, `PartialBot`)
-   **Calculations**: Functions for evaluating bot formulas, calculating values, and managing state
-   **Actions**: System for creating and handling bot mutations and events
-   **Events**: Comprehensive event types for bot operations (add, remove, update, shout, etc.)
-   **Indexing**: Optimized lookup structures for finding bots by tags
-   **State Management**: Helpers for manipulating bot state, applying edits, and tracking changes
-   **Storage**: Serialization formats for persisting bot state

## Main Exports

### Bot (`Bot.ts`)

Core bot type definitions and interfaces:

```typescript
import {
    RuntimeBot,
    Bot,
    BotTags,
    BotSpace,
} from '@casual-simulation/aux-common/bots';

// RuntimeBot interface properties:
interface RuntimeBot {
    id: string; // Unique bot identifier
    link?: string; // Optional parent bot link
    space: BotSpace; // Which space the bot belongs to
    tags: BotTags; // Calculated tag values (formulas evaluated)
    raw: BotTags; // Raw tag values (scripts unevaluated)
    masks?: BotTags; // Tag overrides per space
    links?: string[]; // Array of bot IDs this bot links to
    vars?: { [key: string]: any }; // Runtime variables
    changes: BotTagChanges; // Pending tag changes
    maskChanges: BotMaskChanges; // Pending mask changes
}
```

**Key Bot Symbols**:

-   `CLEAR_CHANGES_SYMBOL`: Clear pending changes
-   `SET_TAG_MASK_SYMBOL`: Set a tag mask
-   `GET_TAG_MASK_SYMBOL`: Get a tag mask value
-   `EDIT_TAG_SYMBOL`: Edit a tag with operations
-   `REPLACE_BOT_SYMBOL`: Replace the entire bot
-   `ADD_BOT_LISTENER_SYMBOL`: Add a listener to a bot

### BotCalculations (`BotCalculations.ts`)

Over 3800 lines of calculation functions for evaluating bot values, formulas, and state operations:

```typescript
import {
    calculateBotValue,
    tagsOnBot,
    calculateStringTagValue,
} from '@casual-simulation/aux-common/bots';

// Calculate a tag value with formula evaluation
const value = calculateBotValue(context, bot, 'myTag');

// Get all tags on a bot
const tags = tagsOnBot(bot); // Returns string[]

// Calculate string representation of a tag
const strValue = calculateStringTagValue(context, bot, 'name', null);
```

**Key Features**:

-   Formula evaluation and script execution
-   Bot value calculations with type coercion
-   State diff operations (`BotsStateDiff`)
-   Workspace configuration and defaults
-   Tween animations and easing functions
-   Bot positioning, orientation, and shape calculations

### BotActions (`BotActions.ts`)

Functions for creating and processing bot actions:

```typescript
import {
    calculateDestroyBotEvents,
    resolveRejectedActions,
} from '@casual-simulation/aux-common/bots';

// Calculate events needed to destroy a bot and its children
const destroyEvents = calculateDestroyBotEvents(bots, botId);

// Filter out rejected actions
const validActions = resolveRejectedActions(actions);

// Break state updates into individual events
const individualEvents = breakIntoIndividualEvents(state, updates);
```

**Action Types**:

-   `AddBotAction`: Create a new bot
-   `RemoveBotAction`: Delete a bot
-   `UpdateBotAction`: Modify bot tags
-   `ApplyStateAction`: Apply bulk state changes

### BotEvents (`BotEvents.ts`)

Comprehensive event system with over 6600 lines defining all possible bot operations:

```typescript
import {
    BotAction,
    ShoutAction,
    AddBotAction,
    UpdateBotAction,
    ShowToastAction,
} from '@casual-simulation/aux-common/bots';

// BotAction is a union of all possible bot actions:
type BotAction =
    | BotActions // Add/Remove/Update
    | TransactionAction
    | ExtraActions // Shout, Toast, Navigation, etc.
    | AsyncActions
    | RemoteAction
    | DeviceAction;
```

**Key Event Categories**:

-   **Bot State**: Add, Remove, Update, ApplyState
-   **Communication**: Shout, SuperShout, SendWebhook
-   **UI**: ShowToast, ShowHtml, ShowInputForTag
-   **Navigation**: GoToDimension, GoToURL, OpenURL
-   **Device**: QR/Barcode scanning, Downloads, Shell commands
-   **Clipboard**: SetClipboard, PasteState

### BotIndex (`BotIndex.ts`)

Optimized indexing system for fast bot lookups by tag:

```typescript
import { BotIndex } from '@casual-simulation/aux-common/bots';

const index = new BotIndex();

// Subscribe to index events
index.events.subscribe((events) => {
    events.forEach((event) => {
        if (event.type === 'bot_tag_added') {
            console.log(`Bot ${event.bot.id} added tag ${event.tag}`);
        }
    });
});

// Add/update/remove bots
index.addBot(bot);
index.updateBot(bot, oldBot);
index.removeBot(bot);

// Batch operations
index.addBots([bot1, bot2, bot3]);
```

**Event Types**:

-   `BotTagAddedEvent`: Bot added a value for a tag
-   `BotTagRemovedEvent`: Bot removed a tag value
-   `BotTagUpdatedEvent`: Bot changed a tag value

### BotLookupTable & BotLookupTableHelper

Fast lookup structures for finding bots by tag values:

```typescript
import {
    BotLookupTable,
    BotLookupTableHelper,
} from '@casual-simulation/aux-common/bots';

const helper = new BotLookupTableHelper();
const lookupTable = new BotLookupTable();

// Add bots to lookup table
helper.addBot(bot);

// Find bots by tag value
const botsWithColor = lookupTable.findBotsWithTag('color', 'red');
```

### BotCalculationContext & BotCalculationContextFactory

Context management for bot calculations and formula evaluation:

```typescript
import {
    BotCalculationContext,
    BotCalculationContextFactory,
} from '@casual-simulation/aux-common/bots';

// Context provides access to bots and calculation state
const context = factory.createContext(bots);

// Use context for calculations
const value = calculateBotValue(context, bot, 'position');
```

### StateUpdatedEvent & TagUpdatedEvent

Event types for tracking state and tag changes:

```typescript
import {
    StateUpdatedEvent,
    TagUpdatedEvent,
} from '@casual-simulation/aux-common/bots';

// StateUpdatedEvent: Tracks complete state changes
interface StateUpdatedEvent {
    state: BotsState;
    addedBots: string[];
    removedBots: string[];
    updatedBots: string[];
}

// TagUpdatedEvent: Tracks individual tag changes
interface TagUpdatedEvent {
    bot: Bot;
    tag: string;
    oldValue: any;
    newValue: any;
}
```

### StoredAux (`StoredAux.ts`)

Serialization formats for persisting bot state:

```typescript
import {
    StoredAux,
    getBotsStateFromStoredAux,
    InstUpdate,
} from '@casual-simulation/aux-common/bots';

// Two storage versions supported:
type StoredAux = StoredAuxVersion1 | StoredAuxVersion2;

// Version 1: Direct state storage
interface StoredAuxVersion1 {
    version: 1;
    state: BotsState;
}

// Version 2: Update-based storage (CRDT)
interface StoredAuxVersion2 {
    version: 2;
    updates: InstUpdate[];
}

// Convert stored format to bot state
const state = getBotsStateFromStoredAux(stored);
```

**InstUpdate**: Represents an update applied to an inst (collaborative space):

```typescript
interface InstUpdate {
    id: number; // Update ID
    update: string; // Update content
    timestamp: number; // When the update occurred
}
```

### AuxStateHelpers (`AuxStateHelpers.ts`)

Utilities for manipulating bot state and applying edits:

```typescript
import {
    edit,
    preserve,
    insert,
    del,
    isTagEdit,
    mergeEdits,
} from '@casual-simulation/aux-common/bots';

// Create a tag edit with operations
const tagEdit = edit(
    version,
    preserve(10), // Keep first 10 chars
    insert('new'), // Insert 'new'
    del(5) // Delete 5 chars
);

// Check if a value is a tag edit
if (isTagEdit(value)) {
    // Handle tag edit operations
}

// Merge two tag edits
const merged = mergeEdits(edit1, edit2);
```

**Tag Edit Operations**:

-   `preserve(count)`: Keep N characters
-   `insert(text)`: Insert text at current position
-   `del(count)`: Delete N characters

**Features**:

-   Operational transformation for concurrent edits
-   Version vector tracking for distributed state
-   Remote edit support for collaborative editing
-   Tag edit merging and conflict resolution

### BotModule

Module system for organizing bot functionality:

```typescript
import { BotModule } from '@casual-simulation/aux-common/bots';

// Define reusable bot modules
const module: BotModule = {
    // Module definition
};
```

## Usage Examples

### Creating and Managing Bots

```typescript
import { Bot, RuntimeBot, createBot } from '@casual-simulation/aux-common/bots';

// Create a new bot
const bot: Bot = {
    id: 'bot1',
    space: 'shared',
    tags: {
        name: 'Player',
        color: 'red',
        position: { x: 0, y: 0, z: 0 },
    },
};

// Calculate bot values with formulas
const calculatedValue = calculateBotValue(context, bot, 'score');

// Update a bot tag
const updateAction: UpdateBotAction = {
    type: 'update_bot',
    id: 'bot1',
    update: {
        tags: {
            score: 100,
        },
    },
};
```

### Using Bot Index for Lookups

```typescript
import { BotIndex } from '@casual-simulation/aux-common/bots';

const index = new BotIndex();

// Add bots to index
index.addBots([bot1, bot2, bot3]);

// Subscribe to changes
index.events.subscribe((events) => {
    for (const event of events) {
        switch (event.type) {
            case 'bot_tag_added':
                console.log(`${event.bot.id}: Added ${event.tag}`);
                break;
            case 'bot_tag_updated':
                console.log(`${event.bot.id}: Updated ${event.tag}`);
                break;
            case 'bot_tag_removed':
                console.log(`${event.bot.id}: Removed ${event.tag}`);
                break;
        }
    }
});
```

### Applying State Edits

```typescript
import {
    edit,
    preserve,
    insert,
    del,
} from '@casual-simulation/aux-common/bots';

// Create an edit that modifies a tag value
const version = { site1: 5 };
const tagEdit = edit(
    version,
    preserve(5), // Keep first 5 characters
    insert('Hello '), // Insert 'Hello '
    del(3), // Delete next 3 characters
    preserve(10) // Keep remaining 10 characters
);

// Apply the edit to a bot
bot.tags.description = tagEdit;
```

### Processing Bot Actions

```typescript
import {
    calculateDestroyBotEvents,
    breakIntoIndividualEvents,
} from '@casual-simulation/aux-common/bots';

// Calculate all events needed to destroy a bot and its children
const destroyEvents = calculateDestroyBotEvents(botsState, 'bot1');

// Process the destroy events
for (const event of destroyEvents) {
    if (event.type === 'remove_bot') {
        delete botsState[event.id];
    }
}

// Break bulk state changes into individual events
const updates = {
    /* bot updates */
};
const individualEvents = breakIntoIndividualEvents(botsState, updates);
```

## Bot System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Bot System                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │     Bot      │──────│BotCalculations│                   │
│  │   (Types)    │      │  (Formulas)   │                   │
│  └──────────────┘      └──────────────┘                   │
│         │                      │                           │
│         │                      ▼                           │
│         │              ┌──────────────┐                    │
│         │              │BotCalculation│                    │
│         │              │   Context    │                    │
│         │              └──────────────┘                    │
│         │                                                  │
│         ▼                                                  │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │  BotActions  │──────│  BotEvents   │                   │
│  │  (Mutations) │      │  (6600 types)│                   │
│  └──────────────┘      └──────────────┘                   │
│         │                                                  │
│         ▼                                                  │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │   BotIndex   │──────│BotLookupTable│                   │
│  │ (Fast Lookup)│      │   (Helper)   │                   │
│  └──────────────┘      └──────────────┘                   │
│         │                                                  │
│         ▼                                                  │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │  StoredAux   │──────│AuxStateHelpers│                  │
│  │ (Persistence)│      │    (Edits)    │                  │
│  └──────────────┘      └──────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Bot Tags and Formulas

-   **Tags**: Properties on bots that can contain data or scripts
-   **Raw Tags**: Unevaluated scripts (starting with `=` or `@`)
-   **Calculated Tags**: Evaluated formulas with computed values
-   **Masks**: Per-space tag overrides

### Bot Spaces

Bots can exist in different spaces:

-   `shared`: Shared across all users
-   `tempShared`: Temporary shared space
-   `tempLocal`: Temporary local space
-   `local`: Local to the current user
-   Custom portal spaces

### State Management

-   **BotsState**: Complete map of bot ID to Bot
-   **PartialBotsState**: Partial bot updates
-   **StateUpdatedEvent**: Tracks state changes
-   **TagUpdatedEvent**: Tracks individual tag changes

### Bot Actions

All bot mutations go through the action system:

1. Create action (AddBotAction, UpdateBotAction, etc.)
2. Process action through runtime
3. Generate resulting state changes
4. Emit state events

### Indexing and Lookups

-   **BotIndex**: Maintains tag-to-bot mappings
-   **BotLookupTable**: Fast queries for bots by tag values
-   Events stream for reactive updates

## Dependencies

This module depends on:

-   `@casual-simulation/aux-common/common`: Common types and utilities
-   `@casual-simulation/aux-common/utils`: Utility functions
-   `@casual-simulation/aux-common/partitions`: Partition utilities for state management
-   `rxjs`: For observable event streams

## Integration Points

The bots module integrates with:

-   **aux-runtime**: Executes bot formulas and scripts
-   **aux-vm**: Provides sandboxed execution environment
-   **aux-records**: Persists bot state to backend
-   **aux-web**: Renders bots in the browser UI
-   **casualos-cli**: Command-line tools for bot management

## Related Packages

-   `@casual-simulation/aux-common`: Parent package containing this module
-   `@casual-simulation/aux-runtime`: Runtime execution engine
-   `@casual-simulation/aux-vm`: Virtual machine abstraction
-   `@casual-simulation/aux-records`: Backend API and persistence
