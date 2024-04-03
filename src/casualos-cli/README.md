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
