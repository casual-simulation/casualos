# RPC (Remote Procedure Call)

Type-safe RPC framework for CasualOS. This folder contains a comprehensive system for defining, validating, and executing remote procedure calls with full TypeScript type safety, schema validation, and error handling.

## Overview

The `rpc` module provides a robust framework for building type-safe APIs with:

-   **Procedure Definition**: Fluent builder API for defining RPC endpoints
-   **Schema Validation**: Zod-based input/output validation
-   **Result Types**: Functional result types with success/failure handling
-   **Error Codes**: Comprehensive error code system with 100+ known error types
-   **Type Safety**: Full TypeScript type inference for inputs, outputs, and errors
-   **HTTP Integration**: Automatic HTTP method/path/response mapping
-   **Streaming Support**: AsyncGenerator support for streaming responses
-   **Context Management**: Rich context including session, IP, origin, tracing

## Main Exports

### GenericRPCInterface (`GenericRPCInterface.ts`)

Core types and builder for defining RPC procedures (743 lines):

```typescript
import {
    procedure,
    Procedure,
    Procedures,
    RPCContext,
    ProcedureOutput,
    RemoteProcedures,
} from '@casual-simulation/aux-common/rpc';

// Define a procedure with type-safe inputs and outputs
const myProcedure = procedure()
    .origins(true) // Allow all origins
    .http('POST', '/api/myendpoint', 'player') // HTTP configuration
    .inputs(
        z.object({
            userId: z.string(),
            data: z.string(),
        })
    )
    .handler(async (input, context) => {
        // input is fully typed: { userId: string, data: string }
        // context provides session, IP, origin, etc.

        if (context.sessionKey === null) {
            return {
                success: false,
                errorCode: 'not_logged_in',
                errorMessage: 'Session required',
            };
        }

        // Do work...
        return { success: true };
    });

// Define a collection of procedures
const procedures = {
    getUser: procedure()
        .http('GET', '/api/users/:id')
        .inputs(z.object({ id: z.string() }))
        .handler(async (input, context) => {
            return { success: true };
        }),

    createUser: procedure()
        .http('POST', '/api/users')
        .inputs(
            z.object({
                name: z.string(),
                email: z.string().email(),
            })
        )
        .handler(async (input, context) => {
            return { success: true };
        }),
};
```

**RPCContext**:

```typescript
interface RPCContext {
    ipAddress: string; // Client IP
    sessionKey: string | null; // Session key from request
    httpRequest?: GenericHttpRequest; // Original HTTP request
    origin: string | null; // HTTP origin
    url: URL | null; // Request URL
    span?: Span; // OpenTelemetry span for tracing
}
```

**Procedure Output Types**:

```typescript
// Success output
interface ProcedureOutputSuccess {
    success: true;
}

// Error output
interface ProcedureOutputError {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
    reason?: DenialReason;
}

// Streaming output
interface ProcedureOutputStream
    extends AsyncGenerator<
        any,
        ProcedureOutputSuccess | ProcedureOutputError
    > {}
```

**Procedure Builder API**:

```typescript
// Step 1: Create procedure
const proc = procedure();

// Step 2: Configure origins
proc.origins(true); // All origins
proc.origins(new Set(['example.com'])); // Specific origins
proc.origins('account'); // Account origins only
proc.origins('api'); // API origins only

// Step 3: Configure HTTP (optional)
proc.http('GET', '/api/endpoint', 'player'); // Player scope
proc.http('POST', '/api/admin', 'auth'); // Auth scope

// Step 4: Configure view (optional)
proc.view('player', '/dashboard'); // View path
proc.view('player', true); // Default view

// Step 5: Define inputs (optional)
proc.inputs(
    z.object({ data: z.string() }), // Body schema
    z.object({ page: z.number() }) // Query schema (optional)
);

// Step 6: Define handler
proc.handler(async (input, context, query) => {
    // Fully typed input, context, and query parameters
    return { success: true };
});
```

**Type Inference**:

```typescript
// Client-side type-safe RPC calls
type Client = RemoteProcedures<typeof procedures>;

// Client will have:
// {
//   getUser: (input: { id: string }, options?: CallProcedureOptions) => Promise<ProcedureOutput>
//   createUser: (input: { name: string, email: string }, options?: CallProcedureOptions) => Promise<ProcedureOutput>
// }

// Call options
interface CallProcedureOptions {
    sessionKey?: string; // Override session key
    endpoint?: string; // Override endpoint URL
    headers?: Record<string, string>; // Additional headers
}
```

### RemoteRPCInterface (`RemoteRPCInterface.ts`)

Helper for creating remote procedure client types:

```typescript
import { remoteProcedures } from '@casual-simulation/aux-common/rpc';

// Create a typed client interface
const client = remoteProcedures<typeof procedures>();

// Use the client with full type safety
const result = await client.getUser({ id: 'user123' });
```

### Result (`Result.ts`)

Functional result types for success/failure handling (312 lines):

```typescript
import {
    Result,
    Success,
    Failure,
    success,
    failure,
    isSuccess,
    isFailure,
    matchResult,
    mapResult,
    flatMapResult,
    unwrap,
    wrap,
    GenericResult,
    ErrorType,
} from '@casual-simulation/aux-common/rpc';

// Create success result
const successResult: Result<number, ErrorType> = success(42);

// Create failure result
const failureResult: Result<number, ErrorType> = failure({
    errorCode: 'not_found',
    errorMessage: 'User not found',
});

// Check result type
if (isSuccess(result)) {
    console.log('Value:', result.value); // Type: number
} else {
    console.error('Error:', result.error); // Type: ErrorType
}

// Match on result
const message = matchResult(result, {
    success: (value) => `Got value: ${value}`,
    not_found: (error) => `Not found: ${error.errorMessage}`,
    server_error: (error) => `Server error: ${error.errorMessage}`,
});

// Map success values
const doubled = mapResult(result, (value) => value * 2);

// Flat map (chain) results
const chained = flatMapResult(result, (value) => {
    if (value > 0) {
        return success(value * 2);
    } else {
        return failure({
            errorCode: 'invalid_value',
            errorMessage: 'Value must be positive',
        });
    }
});

// Unwrap (throws if failure)
try {
    const value = unwrap(result);
    console.log('Unwrapped:', value);
} catch (err) {
    console.error('Failed to unwrap:', err);
}

// Wrap try/catch blocks
const wrapped = wrap(() => {
    // Code that might throw
    return JSON.parse(jsonString);
});

// Wrap async functions
const wrappedAsync = await wrap(async () => {
    return await fetch('/api/data');
});

// Wrap promises directly
const wrappedPromise = await wrap(fetch('/api/data'));
```

**Generic Result Formats**:

```typescript
// Array results
type ArrayResult = { success: true; items: User[] };

// Object results
type ObjectResult = { success: true; id: string; name: string };

// Primitive results
type PrimitiveResult = { success: true; value: number };

// Convert Result to GenericResult
const generic = genericResult(result);
```

**Error Handling Utilities**:

```typescript
import {
    logError,
    logErrors,
    MultiError,
} from '@casual-simulation/aux-common/rpc';

// Log a single error
logError(error, 'API Call');
// Output: "API Call Error: User not found (not_found)"

// Log multiple errors
const multiError: MultiError<ErrorType> = {
    errorCode: 'multi_error',
    errorMessage: 'Multiple errors occurred',
    errors: [error1, error2, error3],
};
logErrors(multiError, 'Validation');

// Log result
const logged = logResult(result, 'Operation result');
```

**Error Types**:

```typescript
// Simple error
interface SimpleError {
    errorCode: KnownErrorCodes;
    errorMessage: string;
    reason?: DenialReason; // Authorization denial details
    issues?: z.core.$ZodIssue[]; // Zod validation issues
}

// Wrapped error (from try/catch)
interface WrappedError {
    errorCode: 'wrapped_error';
    errorMessage: string;
    error: unknown; // Original error
}

// Multi error (multiple failures)
interface MultiError<E> {
    errorCode: 'multi_error';
    errorMessage: string;
    errors: E[]; // Array of errors
}
```

### ErrorCodes (`ErrorCodes.ts`)

Comprehensive error code system with 100+ error types (223 lines):

```typescript
import {
    KnownErrorCodes,
    getStatusCode,
} from '@casual-simulation/aux-common/rpc';

// 100+ known error codes
type KnownErrorCodes =
    // Authentication & Authorization
    | 'not_logged_in' // 401: No authentication
    | 'not_authorized' // 403: No permission
    | 'session_expired' // 401: Session timeout
    | 'session_not_found' // 404: Invalid session
    | 'invalid_token' // 403: Bad token
    | 'user_is_banned' // 403: Banned user

    // Resource Not Found (404)
    | 'data_not_found'
    | 'file_not_found'
    | 'record_not_found'
    | 'user_not_found'
    | 'inst_not_found'
    | 'studio_not_found'
    | 'operation_not_found'
    | 'policy_not_found'
    | 'permission_not_found'
    | 'message_not_found'
    | 'item_not_found'
    | 'not_found'

    // Validation Errors (400)
    | 'invalid_request'
    | 'invalid_code'
    | 'invalid_key'
    | 'invalid_origin'
    | 'invalid_username'
    | 'invalid_display_name'
    | 'invalid_model'
    | 'invalid_file_data'
    | 'data_too_large'
    | 'roles_too_large'
    | 'policy_too_large'

    // Unacceptable Input (400)
    | 'unacceptable_address'
    | 'unacceptable_user_id'
    | 'unacceptable_code'
    | 'unacceptable_session_key'
    | 'unacceptable_request'
    | 'unacceptable_url'
    | 'unacceptable_connection_token'

    // Resource Conflicts (409/412)
    | 'record_already_exists'
    | 'file_already_exists'
    | 'user_already_exists'
    | 'email_already_exists'
    | 'permission_already_exists'
    | 'comId_already_taken'
    | 'price_does_not_match'

    // Rate Limiting & Quotas (429/403)
    | 'rate_limit_exceeded' // 429: Too many requests
    | 'subscription_limit_reached' // 403: Quota exceeded
    | 'not_subscribed' // 403: Subscription required

    // Server Errors (500/503)
    | 'server_error' // 500: Internal error
    | 'service_unavailable' // 503: Service down
    | 'took_too_long' // 504: Timeout
    | 'not_supported' // 501: Not implemented
    | 'action_not_supported'
    | 'hume_api_error' // 500: External API error

    // Store/Commerce
    | 'insufficient_funds'
    | 'item_already_purchased'
    | 'store_disabled'
    | 'currency_not_supported'

    // State Errors
    | 'invalid_connection_state'
    | 'session_already_revoked'
    | 'session_is_not_revokable'
    | 'not_completed';

// Get HTTP status code for error
const response = { success: false, errorCode: 'not_logged_in' };
const statusCode = getStatusCode(response); // Returns 401

// Status code mapping:
getStatusCode({ success: false, errorCode: 'not_logged_in' }); // 401
getStatusCode({ success: false, errorCode: 'not_authorized' }); // 403
getStatusCode({ success: false, errorCode: 'not_found' }); // 404
getStatusCode({ success: false, errorCode: 'rate_limit_exceeded' }); // 429
getStatusCode({ success: false, errorCode: 'server_error' }); // 500
getStatusCode({ success: false, errorCode: 'service_unavailable' }); // 503
getStatusCode({ success: false, errorCode: 'took_too_long' }); // 504
getStatusCode({ success: true }); // 200
```

## Usage Examples

### Defining RPC Procedures

```typescript
import { procedure } from '@casual-simulation/aux-common/rpc';
import { z } from 'zod';

// Simple GET endpoint
const getUser = procedure()
    .origins(true)
    .http('GET', '/api/users/:id', 'player')
    .inputs(z.object({ id: z.string() }))
    .handler(async (input, context) => {
        const user = await db.users.findById(input.id);

        if (!user) {
            return {
                success: false,
                errorCode: 'user_not_found',
                errorMessage: 'User not found',
            };
        }

        return { success: true };
    });

// POST endpoint with query parameters
const searchUsers = procedure()
    .origins(new Set(['app.example.com']))
    .http('POST', '/api/users/search', 'player')
    .inputs(
        z.object({ query: z.string() }), // Body
        z.object({ page: z.number().optional() }) // Query params
    )
    .handler(async (input, context, query) => {
        const page = query?.page ?? 1;
        const results = await db.users.search(input.query, page);

        return { success: true };
    });

// Streaming endpoint
const streamLogs = procedure()
    .http('GET', '/api/logs/stream')
    .inputs(z.object({ since: z.string() }))
    .handler(async function* (input, context) {
        // Yield streaming data
        for await (const log of logStream) {
            yield log;
        }

        // Return final result
        return { success: true };
    });

// Authentication required
const updateProfile = procedure()
    .http('PATCH', '/api/profile')
    .inputs(
        z.object({
            name: z.string().optional(),
            bio: z.string().optional(),
        })
    )
    .handler(async (input, context) => {
        if (!context.sessionKey) {
            return {
                success: false,
                errorCode: 'not_logged_in',
                errorMessage: 'Authentication required',
            };
        }

        // Update profile...
        return { success: true };
    });
```

### Building a Procedures Collection

```typescript
import { procedure, Procedures } from '@casual-simulation/aux-common/rpc';

// Define all procedures
const procedures = {
    // User management
    getUser: procedure()
        .http('GET', '/api/users/:id')
        .inputs(z.object({ id: z.string() }))
        .handler(async (input, context) => ({ success: true })),

    createUser: procedure()
        .http('POST', '/api/users')
        .inputs(z.object({ name: z.string(), email: z.string() }))
        .handler(async (input, context) => ({ success: true })),

    deleteUser: procedure()
        .http('DELETE', '/api/users/:id')
        .inputs(z.object({ id: z.string() }))
        .handler(async (input, context) => ({ success: true })),

    // Data operations
    getData: procedure()
        .http('GET', '/api/data/:key')
        .inputs(z.object({ key: z.string() }))
        .handler(async (input, context) => ({ success: true })),

    setData: procedure()
        .http('POST', '/api/data')
        .inputs(z.object({ key: z.string(), value: z.any() }))
        .handler(async (input, context) => ({ success: true })),
} satisfies Procedures;

// Export for client-side use
export type API = typeof procedures;
```

### Client-Side Usage

```typescript
import {
    remoteProcedures,
    RemoteProcedures,
} from '@casual-simulation/aux-common/rpc';
import type { API } from './server-procedures';

// Create type-safe client
const client: RemoteProcedures<API> = remoteProcedures<API>();

// Make type-safe calls
async function example() {
    // Full type inference for inputs
    const result = await client.getUser({ id: 'user123' });

    // Override session key
    const result2 = await client.createUser(
        { name: 'Alice', email: 'alice@example.com' },
        { sessionKey: 'custom-key' }
    );

    // Override endpoint
    const result3 = await client.getData(
        { key: 'myKey' },
        { endpoint: 'https://api.example.com' }
    );

    // Custom headers
    const result4 = await client.setData(
        { key: 'myKey', value: { data: 123 } },
        { headers: { 'X-Custom': 'value' } }
    );
}
```

### Result Handling Patterns

```typescript
import {
    Result,
    success,
    failure,
    matchResult,
    isSuccess,
} from '@casual-simulation/aux-common/rpc';

// Function returning Result
async function fetchUser(id: string): Promise<Result<User, SimpleError>> {
    try {
        const user = await db.users.findById(id);
        if (!user) {
            return failure({
                errorCode: 'user_not_found',
                errorMessage: 'User not found',
            });
        }
        return success(user);
    } catch (err) {
        return failure({
            errorCode: 'server_error',
            errorMessage: err.message,
        });
    }
}

// Pattern matching
const result = await fetchUser('123');
const message = matchResult(result, {
    success: (user) => `Found user: ${user.name}`,
    user_not_found: (err) => 'User does not exist',
    server_error: (err) => `Error: ${err.errorMessage}`,
});

// Type guard pattern
if (isSuccess(result)) {
    console.log('User:', result.value.name);
} else {
    console.error('Error:', result.error.errorCode);
}

// Chaining operations
const processed = await fetchUser('123')
    .then((result) => mapResult(result, (user) => user.email))
    .then((result) => flatMapResult(result, (email) => validateEmail(email)));
```

### Error Handling

```typescript
import {
    KnownErrorCodes,
    getStatusCode,
    logError,
    SimpleError,
} from '@casual-simulation/aux-common/rpc';

// Create typed error
function createError(code: KnownErrorCodes, message: string): SimpleError {
    return {
        errorCode: code,
        errorMessage: message,
    };
}

// Handle procedure errors
const result = await client.createUser(input);

if (!result.success) {
    const httpStatus = getStatusCode(result);

    switch (result.errorCode) {
        case 'not_logged_in':
            // Redirect to login
            window.location.href = '/login';
            break;

        case 'not_authorized':
            // Show permission error
            showError('You do not have permission');
            break;

        case 'rate_limit_exceeded':
            // Show rate limit message
            showError('Too many requests. Please try again later.');
            break;

        default:
            // Generic error handling
            logError(result.error, 'API Error');
            showError(result.errorMessage);
    }
}
```

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      RPC Framework                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────────────────────────────────┐               │
│  │      GenericRPCInterface               │               │
│  │  ┌──────────────────────────────────┐  │               │
│  │  │   ProcedureBuilder (Fluent API)  │  │               │
│  │  │   - origins()                    │  │               │
│  │  │   - http()                       │  │               │
│  │  │   - inputs()                     │  │               │
│  │  │   - handler()                    │  │               │
│  │  └──────────────────────────────────┘  │               │
│  │                │                        │               │
│  │                ▼                        │               │
│  │  ┌──────────────────────────────────┐  │               │
│  │  │         Procedure                │  │               │
│  │  │  - schema (Zod)                  │  │               │
│  │  │  - querySchema                   │  │               │
│  │  │  - handler                       │  │               │
│  │  │  - http config                   │  │               │
│  │  │  - allowedOrigins                │  │               │
│  │  └──────────────────────────────────┘  │               │
│  │                │                        │               │
│  │                ▼                        │               │
│  │  ┌──────────────────────────────────┐  │               │
│  │  │       RPCContext                 │  │               │
│  │  │  - sessionKey                    │  │               │
│  │  │  - ipAddress                     │  │               │
│  │  │  - origin                        │  │               │
│  │  │  - httpRequest                   │  │               │
│  │  │  - span (tracing)                │  │               │
│  │  └──────────────────────────────────┘  │               │
│  │                │                        │               │
│  │                ▼                        │               │
│  │  ┌──────────────────────────────────┐  │               │
│  │  │      ProcedureOutput             │  │               │
│  │  │  - Success                       │  │               │
│  │  │  - Error                         │  │               │
│  │  │  - Stream (AsyncGenerator)       │  │               │
│  │  └──────────────────────────────────┘  │               │
│  └────────────────────────────────────────┘               │
│                │                                           │
│                ▼                                           │
│  ┌────────────────────────────────────────┐               │
│  │    RemoteProcedures (Type Mapping)     │               │
│  │  Converts server procedures to         │               │
│  │  client-callable functions with         │               │
│  │  full type safety                       │               │
│  └────────────────────────────────────────┘               │
│                                                            │
│  ┌────────────────────────────────────────┐               │
│  │         Result<T, E>                   │               │
│  │  ┌──────────────────────────────────┐  │               │
│  │  │  Success<T>                      │  │               │
│  │  │  - success: true                 │  │               │
│  │  │  - value: T                      │  │               │
│  │  └──────────────────────────────────┘  │               │
│  │  ┌──────────────────────────────────┐  │               │
│  │  │  Failure<E>                      │  │               │
│  │  │  - success: false                │  │               │
│  │  │  - error: E                      │  │               │
│  │  └──────────────────────────────────┘  │               │
│  │                                         │               │
│  │  Functions:                             │               │
│  │  - matchResult() - Pattern matching    │               │
│  │  - mapResult() - Transform success     │               │
│  │  - flatMapResult() - Chain results     │               │
│  │  - wrap() - Catch exceptions           │               │
│  └────────────────────────────────────────┘               │
│                                                            │
│  ┌────────────────────────────────────────┐               │
│  │      ErrorCodes (100+ types)           │               │
│  │  - KnownErrorCodes                     │               │
│  │  - getStatusCode()                     │               │
│  │  Maps error codes to HTTP status       │               │
│  └────────────────────────────────────────┘               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Type-Safe Procedures

The RPC framework provides end-to-end type safety:

1. **Input validation** with Zod schemas
2. **Handler typing** with inferred input/output types
3. **Client generation** with RemoteProcedures type mapping
4. **Query parameters** with separate schema validation

### Result Pattern

The Result type provides functional error handling:

-   **Success/Failure** discrimination with type guards
-   **Pattern matching** for exhaustive error handling
-   **Chaining** operations with map/flatMap
-   **Exception wrapping** with wrap()

### Error Code System

100+ known error codes with:

-   **HTTP status mapping** for web responses
-   **Categorization** by error type (auth, validation, server, etc.)
-   **Client-friendly** error codes for UI handling
-   **Denial reasons** for authorization failures

### Context-Aware Execution

Every procedure receives RPCContext with:

-   **Session information** for authentication
-   **IP address** for rate limiting
-   **Origin** for CORS handling
-   **Tracing span** for observability
-   **HTTP request** for advanced use cases

### Streaming Support

Procedures can return AsyncGenerators for:

-   **Server-sent events** style streaming
-   **Progress updates** during long operations
-   **Real-time data** feeds
-   **Final result** after stream completes

## Dependencies

This module depends on:

-   `zod`: Schema validation for inputs and outputs
-   `@opentelemetry/api`: Distributed tracing spans
-   `@casual-simulation/aux-common/http`: HTTP interface types
-   `@casual-simulation/aux-common/common`: DenialReason types

## Integration Points

The rpc module integrates with:

-   **aux-records**: Uses RPC framework for all API endpoints
-   **aux-server**: HTTP server maps routes to procedures
-   **aux-web**: Client uses RemoteProcedures for API calls
-   **aux-runtime**: Executes procedures in sandboxed environments

## Related Packages

-   `@casual-simulation/aux-records`: Backend API using this RPC framework
-   `@casual-simulation/aux-common/http`: HTTP interface abstractions
-   `@casual-simulation/aux-common/common`: Common types for errors and denial reasons
