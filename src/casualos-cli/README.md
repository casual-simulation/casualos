# CasualOS CLI

[![npm (scoped)](https://img.shields.io/npm/v/casualos.svg)](https://www.npmjs.com/package/casualos)

## Installation

Install to your global package directory:

```bash
$ npm install -g casualos
```

Or, execute directly from NPM:

```bash
$ npx casualos
```

## Usage

```
Usage: casualos [options] [command]

A CLI for CasualOS

Options:
  -V, --version                        output the version number
  -e, --endpoint <url>                 The endpoint to use for queries. Can be used to override the current endpoint.
  -h, --help                           display help for command

Commands:
  login                                Login to the CasualOS API
  logout                               Logout of the CasualOS API
  set-endpoint [endpoint]              Set the endpoint that is currently in use.
  status                               Get the status of the current session.
  query [options] [procedure] [input]  Query the CasualOS API
  repl [options]                       Start a REPL for the CasualOS API
  help [command]                       display help for command
```

### Commands

#### `login`

```
$ casualos help login

Usage: casualos login [options]

Login to the CasualOS API

Options:
  -h, --help  display help for command
```

#### `logout`

```
$ casualos help logout

Usage: casualos logout [options]

Logout of the CasualOS API

Options:
  -h, --help  display help for command
```

#### `set-endpoint`

```
$ casualos help set-endpoint

Usage: casualos set-endpoint [options] [endpoint]

Set the endpoint that is currently in use.

Arguments:
  endpoint    The endpoint to use for queries. If omitted, then you will be prompted to enter an endpoint.

Options:
  -h, --help  display help for command
```

#### `query`

```
$ casualos help query

Usage: casualos query [options] [procedure] [input]

Query the CasualOS API

Arguments:
  procedure        The procedure to execute. If omitted, then you will be prompted to select a procedure.
  input            The input to the procedure. If specified, then it will be parsed as JSON. If omitted, then you will be prompted to enter the input.

Options:
  -k, --key <key>  The session key to use for the query. If not specified, then the current session key will be used.
  -h, --help       display help for command
```

#### `repl`

```
$ casualos help repl

Usage: casualos repl [options]

Start a REPL for the CasualOS API

Options:
  -k, --key <key>  The session key to use for the session. If omitted, then the current session key will be used.
  -h, --help       display help for command

The CasualOS REPL allows you to interact with the CasualOS API using a Read-Eval-Print Loop (REPL).
It supports JavaScript and has a special function, query([procedure], [input]), that can be used to query the API.
```

### REPL Usage

The CasualOS REPL allows you to interact with the CasualOS API using a Read-Eval-Print Loop (REPL).

It supports JavaScript and has a special function, `query([procedure], [input])`, that can be used to query the API. You can access it via the `repl` command.

After every evaluation, the `_` variable will contain the result of the evaluation. Additionally, you can assign values to variables to store them for the entire session.

#### `query([procedure], [input])`

The `query()` function can be used inside a REPL session to query the API of the currently set endpoint.
It accepts two optional parameters, `procedure` and `input`, and returns a promise that resolves with the result of the query. Because it returns a promise, you can use the `await` keyword on it to get the result of the query.

-   `procedure` should be a string and is the name of the procedure that should be executed. If omitted, then you will be prompted from a list of available procedures.

-   `input` can be any JavaScript value that matches the schema of the procedure. If omitted, then you will be prompted to fill in values for the procedure input.

To use `query()` in a REPL session, run `await query()`. This will start a query and wait until the query has a result. If you already know which operation you want to execute, you can run `await query("procedureName")`. This will skip the initial selector, but will still prompt you for inputs. If you already have the procedure and inputs, then you can run `await query("procedureName", input)`. This will skip all prompts and will return the procedure result directly back to you.

If you don't provide an input, then `query()` will automatically prompt you for inputs based on the metadata of the procedure.
When answering prompts for `query()`, you can use a script by entering a `.` at the start of the input value. This will let you use the result of a JavaScript expression for the value. For example, when entering a string for `expireTimeMs`, you could write `.Date.now() - (1000 * 60 * 60)` to calculate 1 hour in the past in miliseconds. If you want to write a string that starts with a period (`.`), then just write two dots at the start. For example, instead of `.myString`, you would write `..myString`. These special instructions only apply to the `query()` function inside `repl`, and not to the `query` command.
