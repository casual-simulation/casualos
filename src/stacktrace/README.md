# Stacktrace

[![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/stacktrace.svg)](https://www.npmjs.com/package/@casual-simulation/stacktrace)

A library to help with parsing stack traces from browser/node exceptions.

Forked from [Sentry.io's tracekit.ts](https://github.com/getsentry/sentry-javascript/blob/fd68dfa266fbea7c93712692aa8cfac7d6572802/packages/browser/src/tracekit.ts) which in turn was forked from the [Tracekit repository](https://github.com/occ/TraceKit).

Why did we fork it? Well, we wanted a well-tested cross-browser stacktrace parser and figured that the Sentry.io parser was our best candidate. We forked it since there wasn't a package for it. An alternative would be to use the [error-stack-parser](https://github.com/stacktracejs/error-stack-parser) package but there seem to be a couple issues around supporting anonymous functions and such.

## Installation

```
npm install @casual-simulation/stacktrace
```
