# Causal Trees

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/causal-trees.svg)](https://www.npmjs.com/package/@casual-simulation/causal-trees)

Create persistent, distributed, realtime, and conflict-free data types.

## Installation

```
npm install @casual-simulation/causal-trees
```

## Features

### Custom CRDTs

Causal Trees enable the creation of custom CRDT data types and can be optimized for disparate use-cases. This ranges from Last-Write-Wins to Sequences and Text Editing.

### Data Integrity

Causal Trees uses hash chains structured as a Reverse [Merkle Tree](https://en.wikipedia.org/wiki/Merkle_tree) to ensure not only that data is consistent but also that causality is preserved in even the most hostile environments.

### Performance

Causal Trees are built on top of immutable data structures and also permit a variety of garbage collection techniques. This makes Causal Trees good for realtime synchronization scenarios due to optimization for low-latency and high-throughput.

### Isomorphic

Causal Trees don't care whether they're running in a browser environment, node.js, or in an electron app. All networking is done by the application developer which enables additional performance gains via more better handling of things like batching and caching.

### History

Causal Trees can be combined with Causal Repos to provide Git-like history capabilities. Causal Trees handle fine-grained, realtime edits while Causal Repos handle large, annotated edits. Create and revert commits to save specific states of a Causal Tree.

## Background

_For a super in-depth read, see: http://archagon.net/blog/2018/03/24/data-laced-with-history/_

### Overview

Causal Trees are data structures that perserve history and are defined in such a way as to avoid merge conflicts.

Causal Trees are closesly related to "gametape" (i.e. [event sourcing][event-sourcing]) and [Conflict-free Replicated Data Types (CRDTs)][crdt].

Remember that a "gametape" is just a list of operations (a.k.a events).
In the gametape pattern operations are simply operations which contain a timestamp. When two players are synced they share their gametapes and sort the operations by their timestamp and replay each operation in order.

Causal Trees also use operations but in this case device timestamps are replaced with [Lamport Timestamps][lamport] and additionally contain a parent reference and a "site" ID. As a result, instead of a list of operations, causal trees represent a graph of operations.

Finally, in Causal Trees operations are called Atoms.

A **Lamport Timestamp** is just a counter. So the start event has time `0` and the next has `1` and then `2`, etc. The key is that operations will end up with the same timestamp. This is because when User A creates event `5` they might not have received User B's event `5` yet. This is fine because the goal of Lamport timestamps is to be able to tell what other operations a particular location knows about when a new event is created. This helps maintain consistency over using real-world time because real-world time never stops and so if User B is offline for a week we won't be able to tell if the operations they created are based on the latest versions or not.

The **Parent Reference** is used to group related operations. While it seems to make sense that all we need is the Lamport timestamp, we actually need both. This is because Causal Trees are a graph of operations and as such multiple branch merges can happen while a user is offline. The timestamp only tells us what the User's expected event order is but not _where_ they are making their branch points. Note that the parent reference **must** only be used for operations that are dependent on previous changes. For example creating a file is not dependent on other operations but changing a file's content is. The file can be created without a parent but changing the content requires whatever the previous value was in order to disambiguate concurrent edits.

The **Site ID** is is just an ID for a source of operations. Usually this is a user but in some cases a single user is operating multiple devices and therefore multiple sites. Once again we need this because the Lamport timestamp only tells us a device's expected order but it doesn't tell us what that device is. Using a site ID lets us distinguish between the event originators. This is important because when two different sites submit operations with the same lamport timestamp we simply need a way to ensure that the events are evaluated in the same order across all devices. The site ID is a simple way to do this.

So in the end Causal Tree atoms looks something like this:

```typescript
interface Id {
    /**
     * The lamport timestamp of the operation.
     */
    timestamp: number;

    /**
     * The site that this operation originated from.
     */
    site: number;

    /**
     * The local index of the operation in the operation list.
     * This is used as an optimization so that looking up parent references
     * is simply a jump to an array index instead of a linear search.
     * O(1) instead of O(n)
     */
    index: number;
}

interface Atom<T> {
    /**
     * The ID of the operation.
     */
    id: Id;

    /**
     * The ID of the parent to this operation.
     * If null then this operation is the root.
     */
    cause: Id | null;

    /**
     * The value of the operation. This is the payload.
     * Usually represents the action that the operation takes.
     */
    value: T;
}
```

## Merge Conflicts

Such a data structure will always be able to arrive at a consistent result. No matter when new events are added and where they are added. This, however, is a separate issue from merge conflicts.

For example, what if we have a Causal Tree that represents a dictionary and two sites set the key `"message"` to two separate values?
In a typical scenario, we might utilize a last-write-wins merge stategy where the last event in the order is the one that we use. This makes sense in most scenarios but some can still catch users off guard.

Take our scenario:

(`S1` refers to "site 1" and `S2` refers to "site 2". Also `T1` refers to "time 1". As such `S1@T1` means "site 1 at time 1")

```
root ------- (S1@T1 set message:"Hello") ---- ?
      \                                      /
       + --- (S2@T1 set message:"World") -- +
```

Who should win?

Should the result be `message:"Hello"` or `message:"World"`?
If we sort site IDs in ascending order then the result is `message:"Hello"` but if we sort them in descending order then the result is `message:"World"`.

So that shows we will be consistent bue the result isn't always what's expected by the user. Site 1's user clearly expects `message:"Hello"` and Site 2's clearly expects `message:"World"`. This is important because it shows that if we want users to have the _most correct_ results we need to have merge conflicts. Some of these scenarios can be tailored to the application but in some scenarios it's only possible to know after asking the user.

## AUX

So what does this look like in AUX?

_Note that we have to be careful with the AUX data structure because it is supposed to be shared with other SO4-style applications._

As it currently stands, AUX uses a library we wrote called _Channels_ to do most of the heavy lifting for realtime sync.

Channels is a simple wrapper around Socket.io that allows state to be synced between devices. The idea is that a channel is able to send and receive events and store the current state. Whenever an event is received, it is applied to the current state. Whenever we want to send an event we first apply it to the current state and then send it to the server which then relays it to the other users.

This works for many cases, but it breaks down when offline scenarios are introduced. To solve this, we would record the last known server state along with the local state. If the user was offline we would let them issue events against the local state and when they went back online we would get the updated server state and do a simple 3-way merge using the last known server state as the base.

```
root -- + ------------------ + -------- + < State gets merged
            \ < User goes offline      /
             + --- + ---- + --------- +
```

Unfortunately, this would break down in scenarios where the last known server version was not preserved properly or was never recorded or required more version history than was kept. Additionally if merge conflicts happened the user's state would not be able to be shared with the server until they were resolved.

This is where we have an opportunity to simplify how channels works and also provide a great foundation for deterministic syncing.

## Garbage Collection

So, if we're storing full revision history, what about storage space?
This depends heavily on what merge strategy the Causal Tree uses. If it's using a last-write-wins strategy we can simply discard everything that is not the most recent write to a particular field. If we're using a more complicated sequence strategy like text editing that involves inserts and deletions then garbage collection becomes more difficult.

In addition, we may not even need to garbage collect data if we store events in an efficient manner.
This generally means minimizing the amount of waste data like using strings for types and identifiers when numbers suffice.

For example, the GUIDs are 36 characters long by default (32 digits and 4 hyphens) and most web browsers use UTF-16 which means each character takes 2 bytes.
This means that each GUID takes 72 bytes. In that amount of space you could store 9 numbers. (In JS the `number` data type is 8 bytes)
Using more effecient data types could put that even lower. JS doesn't support lower precision data types but WebAssembly does. So, it may be possible to improve storage efficiency using WebAssembly.

Other strategies can be used to improve memory usage. For example, doing some pre-processing on the operations to replace long GUID values with short numbers via a dictionary.

[lamport]: https://en.m.wikipedia.org/wiki/Lamport_timestamps
[event-sourcing]: https://www.martinfowler.com/eaaDev/EventSourcing.html
[crdt]: https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type
