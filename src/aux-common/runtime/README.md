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
