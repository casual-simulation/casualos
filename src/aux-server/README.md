# AUX Server

A web application that serves the CasualOS experience.
Built on top of the AUX Common library.

## Getting started

For running a standalone version, see [GettingStarted-standalone](./GettingStarted-standalone.md).

For running on AWS, see [GettingStarted-aws](./GettingStarted-aws.md).

## Components

### aux-backend

The backend contains files and services that are involved in serving the frontend files and also supporting online features like user-to-user collaboration and permanent data storage.

There are two seperate implementations which each implement the same three endpoints.

#### Endpoints

A running instance of the CasualOS backend is able to provide two separate endpoints:

-   Inst hosting
    -   This endpoint usually runs on either port `80` or port `3000` and serves the player frontend.
-   Auth hosting
    -   This endpoint usually runs on port `3002` and serves the auth frontend.

#### Implementations

There are two separate implementations of the backend: `server` and `serverless/aws`.

`server` provides a standalone implementation. It is optimal for running CasualOS on a single machine or at small scales. For instructions running this type of implementation, see [GettingStarted-standalone](./GettingStarted-standalone.md).

`serverless/aws` provides an implementation that runs on AWS Lambda. It is optimal for running CasualOS in the cloud or at larger scales. For instructions running this type of implementation, see [GettingStarted-aws](./GettingStarted-aws.md).
