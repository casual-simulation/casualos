---
applyTo: '**/*.ts'
description: This file contains TypeScript-specific coding standards and documentation guidelines.
---

# Project general coding standards

## Naming conventions

-   Use camelCase for variable and function names.
-   Use PascalCase for class names.
-   Prefix private class members with an underscore (`_`).
-   Use ALL_CAPS for constants.

## Code style

-   Use ES6 modules for imports and exports.
-   Use const for variables that are not reassigned.
-   Use let for variables that are reassigned.
-   Use arrow functions for anonymous functions.
-   Use template literals for string concatenation.
-   Use async/await for asynchronous code.

## Error handling

-   Use try/catch for error handling in functions that return void.
-   Always log errors to the console.
-   Include the class name and method name in error messages.

## Documentation

-   Use JSDoc comments for public APIs.
-   Use eslint and prettier for code formatting and linting.
