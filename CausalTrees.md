# Causal Trees

_For a super in-depth read, see: http://archagon.net/blog/2018/03/24/data-laced-with-history/_

## Overview

Causal Trees are data structures that perserve history and are defined in such a way as to avoid merge conflicts.

Causal Trees are closesly related to "gametape" (i.e. event sourcing).

Remember that a "gametape" is just a list of operations (a.k.a events).
In the gametape pattern operations are simply operations which contain a timestamp. When two players are synced they share their gametapes and sort the operations by their timestamp and replay each operation in order.

Causal Trees also use operations but in this case timestamps are replaced with [Lamport Timestamps][lamport] and additionally contain a parent reference and a "site" ID. Additionally, instead of simply a list of operations, causal trees represent a graph of operations.

A **Lamport Timestamp** is just a counter. So the start event has time `0` and the next has `1` and then `2`, etc. The key is that operations will end up with the same timestamp. This is because when User A creates event `5` they might not have received User B's event `5` yet. This is fine because the goal of Lamport timestamps is to be able to tell what other operations were around when a new event is created. This helps maintains consistency over using real-world time because real-world time never stops and so if User B is offline for a week we won't be able to tell if the operations they created are based on the latest versions or not.

The **Parent Reference** is used to group related operations. While it seems to make sense that all we need is the Lamport timestamp, we actually need both. This is because Causal Trees are a graph of operations and as such multiple branch merges can happen while a user is offline. The timestamp only tells us what the User's expected event order is but not _where_ they are making their branch points. Note that the parent reference **must** only be used for operations that are dependent on previous changes. For example creating a file is not dependent on other operations but changing a file's tag is. The file can be created without a parent but changing the tag requires whatever the previous value was in order to disambiguate concurrent edits.

The **Site ID** is is just an ID for a source of operations. Usually this is a user but in some cases a single user is operating multiple devices and therefore multiple sites. Once again we need this because the Lamport timestamp only tells us a device's expected order but it doesn't tell us what that device is. Using a site ID lets us distinguish between the event originators. This is important because when two different sites submit operations with the same lamport timestamp we simply need a way to ensure that the events are evaluated in the same order across all devices. The site ID is a simple way to do this.

So in the end Causal Tree operations looks something like this:

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

interface Operation<T> {
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

## File Sim

So what does this look like in file simulator?

Currently, File Simluator uses operations to build a state which is then shared with other users as needed.
No revision history is kept because operations are discarded after they are applied to the state.
When a user goes offline, they store the last known server state and when they regain a connection they download the latest server state and do a simple 3-way merge using the local, new server, and original serve states to try and detect merge conflicts. This can cause some issues. Most notably, when a simulation gets cleared. Because we don't store the full revision history, other users can't tell whether the user deleted a bunch of files or if they added a bunch of files. In the current state it favors preserving their data, which is probably for the best.

A better solution would be to get full revision history stored in a Causal Tree. This would allow us to store full revision history and therefore ensure a consistent state between all users.

So, if we're storing full revision history, what about storage space?
This depends heavily on what merge strategy the Causal Tree uses. If it's using a last-write-wins strategy we can simply discard everything that is not the most recent write to a particular field. If we're using a more complicated sequence strategy like text editing that involves inserts and deletions then garbage collection becomes more difficult.

In addition, we may not even need to garbage collect data if we store events in an efficient manner.
This generally means minimizing the amount of waste data like using strings for types and identifiers when numbers suffice.

For example, the GUIDs are 36 characters long by default (32 digits and 4 hyphens) and most web browsers use UTF-16 which means each character takes 2 bytes per character.
This means that each GUID takes 72 bytes. In that amount of space you could store 9 numbers. (In JS the `number` data type is 8 bytes) 
Using more effecient data types could put that even lower. JS doesn't support lower precision data types but WebAssembly does. So, it may be possible to improve storage efficiency using WebAssembly.

Other strategies can be used to improve memory usage. For example, doing some pre-processing on the operations to replace long GUID values with short numbers via a dictionary.

[lamport]: https://en.m.wikipedia.org/wiki/Lamport_timestamps