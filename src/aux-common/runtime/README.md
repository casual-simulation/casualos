# AUX Runtime

The runtime of AUX is a set of services and utilities that make it possible to execute user scripts in a performant manner.

## Goals

### 1. Full JavaScript support.

The runtime should support all of the JavaScript features that the underlying browser supports and should encourage traditional JavaScript syntax and semantics instead of custom tricks.

The runtime may provide polyfills for unsupported features and may also insert additional code for the sake of debugging, tracing, error handling, or "performance management". "performance management" in this case means doing things like adding infinite loop detection and handling other common scenarios that can cause a user script to lock up the rest of the system. (See #2)

### 2. Doesn't lock up the system

The runtime should be able to supervise user scripts so that a bad behaving script can be caught and stopped to prevent the system from getting locked up. This is important since a script that locks up the system can prevent the processing of bot update events which can cause the issue to be unfixable.

### 3. Rich APIs

The runtime should be able to provide a rich set of APIs to user scripts. This means dispatching actions, synchronous queries, asynchronous queries, updating bots, and more.

Some specific needs:

-   Some APIs need to know which bot is calling into it.
-   APIs need to be able to edit bots such that the edits are immediately available to scripts.
-   APIs need to be able to query current bot data.
-   APIs need to enqueue actions.
-   Some APIs need to know how to get the current player bot.
-   Some APIs need to know the current energy state of the system.

See the [current API documentation](https://docs.casualsimulation.com/docs/actions) for examples.

### 4. Low Overhead

The runtime should pre-compile as much user-code as possible to reduce latency and general overhead. Sending a shout into the runtime should be as simple as looping through bots and calling the compiled function.

In the old system, sending a shout involves building the correct state, finding the bots with listeners, sorting the resulting bots, setting up the variables, and evaluating it. Most of the performance hit occurs due to lots of data copying and the deepening of the stack trace. Each shout adds about 10 extra stack frames which can compound over time.

### 5. Great developer experience

The runtime should enable a great developer experience by exposing metadata to assist with common operations like error handling and logging. Error stack traces should be walkable and traceable back to the original source. APIs should have type definitions so that code editing is a breeze.

## Constraints

The AUX Runtime has a couple of weird edge cases that it needs to work with. In particular, it needs to handle the following:

### Modifying unchangable bots

Bots can have any number of rules accociated with how they can be modified. Most bots allow all modifications and their storage spaces have robust rules for handling those modifications. However, some bot spaces have specialized rules.

For example:

-   The `history` partition prevents all edits. Bot in the partition cannot be added, removed or updated.
-   The `error` partition only allows creating bots. Once a bot is created, it cannot be updated or removed.

This causes a weird challenge with a persistent runtime environment. In the previous system the runtime environment would be created and subsequently destroyed when finished executing. This allowed edits to restricted bots to be made but the changes would be reverted once the runtime environment was re-created. With the new system, we need to track changes and whether they have been successful or not so that they can be reverted to prevent the system from deviating too far from the actual result.

The question is whether to use an optimistic model, a pessimistic model, or a synchronous model.
Basically, the pessimistic model assumes every write will fail while the optimistic model assumes every write will succeed. This is in contrast to the synchronous one which will validate each write with the partition as it is made.

The current system is pessimistic since it clears all changes after submitting them for persistence. This ensures that the data is always as close as possible to what is stored but can cause some weird anomalies. For example, two immediate shouts into the system can see very different data.

On the other hand, an optimistic model will preserve edits during persistence but then relies on additional communication to ensure that the runtime does not deviate too much.
If a write fails, then that failure needs to be communicated to the runtime so it can revert the changes. Due to the nature of storage, networking, and persistence,
it is often impossible to predict whether a particular write will pass or fail.
This fact makes handling failures more challenging than the pessimistic model.

Finally, the synchronous model will check each edit once it occurs to see if it is valid.
This may be appealing at first but there are a couple of obvious issues. Most notably, some partitions are split between threads and so cannot be run synchronosuly without greatly complicating their architecture. Additionally, the performance cost of checking each individual edit is likely quite high. Finally, data producing functions would need to be modified to surface these errors otherwise we risk users running into difficult to debug issues. (e.g. `create()` succeeds but no bot was actually created. Subsequent code likely depends on the bot actually existing after the function call.)

Let's go over some pros and cons:

#### Pessimistic Model

Assumes that changes will be denied by the partition.

_Pros:_

-   Simple to implement.
-   Ensures that the data never drifts too far from the actual.

_Cons:_

-   Subsequent calls can see very different data even if the changes were valid.
    -   This makes properly handling async basically impossible.
    -   Also is more likely to happen in larger simulations since partitions run asynchronously.
-   Scripts may see invalid data.
    -   This can happen because edits are accepted in-memory before being submitted to the partitions.

#### Optimistic model

Assumes that changes will be accepted by the partition.

_Pros:_

-   Subsequent calls will see the same data.
    -   Async works out of the box without tons of edge cases.

_Cons:_

-   Scripts may see invalid data.
    -   This can happen because edits are accepted in-memory before being submitted to the partitions.
-   Difficult to implement.
    -   Rejected changes need to be sent back to the runtime so it can be updated.
-   Runtime may drift from the actual over time due to communication issues.

#### Synchronous model

Checks each edit against a partition's storage rules.

_Pros:_

-   Subsequent calls will see the same data.
    -   Async works out of the box.
-   Scripts never see invalid data.

_Cons:_

-   Difficult to implement.
    -   Requires additional changes to the runtime interface.
    -   All edits need to be checked.
    -   May be impossible depending on the implementation strategy.

#### Partitions

Let's talk about partitions. They seem to be an important factor in deciding which strategy to use. Partitions are persistent storage mechanisms for bots. When a bot is added to a universe, it is stored in a partition. Just like a normal file system, partitions are separate from each other and show up as different spaces. Unlinke a normal file system, partitions define the rules for how the data is stored. Normally, that honor goes to the actual storage device. (HDD, SSD, Flash Memory, Network, etc.)
In our case, partitions handle both. Additionally, partitions are expected to provide certain guarentees. In particular:

-   All partition operations are expected to succeed.
    -   Basically, it must not error and must automatically resolve conflicts with concurrent edits.
-   Partitions may decide to drop edits for any reason.
-   Partitions must emit events representing changes to its data.
-   Partitions must provide a snapshot of their current state.

These rules are pretty simple but predicting the result of an operation can be difficult when a partition can drop an edit due to bullet point 2. Note that in order to predict the result of an edit we need to know 2 things:

-   Which partition the edit is for.
-   Whether the partition supports/accepts the edit.

If we change bullet point 2 to be more restrictive, then we can support the synchronous model. So instead of allowing dropped edits for any reason, we should change it to allow dropped edits for a _specific set of reasons_. In particular, a partition must support a particular realtime edit strategy. Here are the three strategies:

-   `all` - Realtime edits are supported and will produce update events once processed.
-   `nonLocal` - Realtime edits are not supported. Edits may be used to update some non-local state. Update events may be produced at some point in the future. (supports history and error partitions)

Using these rules, we can decide whether an edit should update the bot's runtime data or if it should simply send the events to the partition.
