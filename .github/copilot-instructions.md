# CasualOS Copilot Coding Agent Instructions

## Repository Overview

**CasualOS** is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences. This is a large-scale TypeScript/JavaScript monorepo (36+ packages) using Lerna for package management, built with modern web technologies including Vue.js, Three.js, and Node.js.

**Repository Statistics:**

-   36 workspace packages total (34 in src/ + docs + root)
-   Primary languages: TypeScript (80%), JavaScript, Vue, HTML, CSS
-   Package manager: pnpm v10.10.0+ (managed by corepack)
-   Node.js: v20.18+ required
-   Build tool: TypeScript compiler + esbuild + Vite
-   Test framework: Jest
-   Linting: ESLint v9 with TypeScript ESLint
-   Docker support for development services

## Build and Development Workflow

### Prerequisites and Environment Setup

**ALWAYS run these commands in this exact order before any other operations:**

1. **Enable corepack** (critical for pnpm):

    ```bash
    corepack enable
    ```

2. **Install dependencies** (use frozen lockfile in CI, regular install for development):

    ```bash
    npm run bootstrap  # Production: pnpm install --frozen-lockfile
    # OR for development without network restrictions:
    npm run bootstrap -- --ignore-scripts
    ```

3. **Start development services** (required for full functionality):
    ```bash
    # Choose one based on your Docker setup:
    npm run nerdctl:dev    # If using nerdctl/Rancher Desktop
    npm run docker:dev     # If using standard docker
    ```

### Build Commands - Execution Order and Timing

**CRITICAL: Build commands must be run in this specific order:**

1. **Clean** (30 seconds):

    ```bash
    npm run clean  # Removes built files, runs jake clean
    ```

2. **Build Libraries First** (2-4 minutes):
    ```bash
    npm run build:libs  # TypeScript compilation: tsc --build
    ```
3. **Build Full Project** (5-8 minutes total):
    ```bash
    npm run build  # Complete build including server, proxy, CLI
    ```

**Known Issues & Workarounds:**

-   **Prisma Generation Failure**: Bootstrap may fail with "binaries.prisma.sh ENOTFOUND" - use `--ignore-scripts` flag and generate Prisma separately
-   **Memory Issues**: Use `--max_old_space_size=4096` for Node.js in memory-intensive operations
-   **Build Dependencies**: Libraries MUST be built before server/web components
-   **Docker Services**: MongoDB, Redis, and other services in docker-compose.dev.yml are required for full functionality
-   **Git Tags Missing**: Some builds (CLI) require git tags for version info - expect failures in fresh clones without release tags
-   **Windows-specific**: Special node-gyp configuration required (see CI workflow)

### Testing Commands

**Test Execution Order:**

```bash
# Run all tests (10-15 minutes):
npm test  # Equivalent: jest --verbose

# Watch mode for development:
npm run test:watch

# CI testing (with proper flags):
npm run test:ci  # Includes --no-cache --ci flags
```

**Common Test Issues:**

-   Tests may fail if Docker services aren't running
-   Some tests have network dependencies and console warnings (expected)
-   Use `--detectOpenHandles --forceExit` flags for complete test runs

### Linting and Code Quality

**Linting Commands:**

```bash
npm run lint              # Full repository lint
npm run lint:common       # Individual package linting
npm run lint:server       # Server-specific linting
```

**Key Linting Rules:**

-   Header comments required on most TypeScript files
-   Consistent type imports: Use `import type` for type-only imports
-   No unused imports (auto-fixable)
-   Vue component specific rules in components directories

## Project Architecture and Layout

### Core Directory Structure

```
/
├── .github/                    # GitHub workflows, templates, instructions
├── docs/                       # Documentation site (Docusaurus)
├── script/                     # Build helpers, deployment scripts
├── docker/                     # Development services configuration
├── src/                        # All source packages (34 packages)
│   ├── aux-common/            # Core shared utilities and types
│   ├── aux-server/            # Main web application server
│   │   ├── aux-backend/       # Backend API and data layer (includes Prisma)
│   │   ├── aux-web/          # Frontend Vue.js application
│   │   └── aux-player/       # Embedded player component
│   ├── aux-vm/               # Virtual machine abstraction
│   ├── aux-vm-browser/       # Browser VM implementation
│   ├── aux-vm-client/        # Client VM implementation
│   ├── aux-vm-node/          # Node.js VM implementation
│   ├── aux-records/          # Data records management
│   ├── aux-runtime/          # Runtime execution engine
│   ├── casualos-cli/         # Command-line interface
│   └── [21 other packages]   # Supporting libraries (crypto, websocket, etc.)
├── package.json              # Root package.json with scripts
├── lerna.json               # Lerna configuration
├── tsconfig.json            # TypeScript project references
└── pnpm-workspace.yaml      # PNPM workspace configuration
```

### Key Configuration Files

-   **eslint.config.mjs**: ESLint v9 flat config with TypeScript rules
-   **tsconfig.json**: TypeScript project references for all packages
-   **jest.config.js**: Jest testing configuration with ts-jest
-   **lerna.json**: Monorepo package management
-   **docker/docker-compose.dev.yml**: Development services (MongoDB, Redis, MinIO, etc.)

### CI/CD Pipeline (GitHub Actions)

**Continuous Integration (.github/workflows/continuous-integration-workflow.yml):**

-   Triggers: All branches except master/staging/release
-   Matrix: ubuntu/macOS/windows with Node 20.x
-   Steps: bootstrap → test → build → lint → docs build
-   **Critical**: Uses `corepack enable` and specific node-gyp setup for Windows

**Release Pipeline (.github/workflows/release.yml):**

-   Triggers: master, staging, release/\* branches
-   Steps: test → build → npm publish → docs deploy → Docker build/push
-   Publishes to NPM, DockerHub, and GitHub Container Registry

**Known CI Issues:**

-   Windows requires special node-gyp configuration
-   Tests use `--max_old_space_size=4096` for memory management
-   Docker builds have ARM32/ARM64 variants via AWS CodeBuild

## Development Best Practices

### Code Style Guidelines (from existing .github/instructions)

-   **Naming**: camelCase (variables/functions), PascalCase (classes), ALL_CAPS (constants)
-   **Private members**: prefix with `_` and use `private` keyword
-   **Imports**: Use ES6 modules, prefer `import type` for types
-   **Documentation**: JSDoc with required `@dochash` and `@docid` tags
-   **Error handling**: try/catch for void functions, always log errors with class/method names

### TypeScript Project References

The repository uses TypeScript project references for efficient incremental builds. Each package in src/ has its own tsconfig.json that references dependencies.

### Package Dependencies

-   **Critical**: aux-common is foundational - many packages depend on it
-   **Build order**: Libraries (aux-common, aux-vm, etc.) → Server → Applications
-   **Circular dependencies**: Avoided through careful architecture

## Quick Start for Common Tasks

### Making Code Changes

1. `corepack enable && npm run bootstrap`
2. `npm run docker:dev` (start services)
3. `npm run clean && npm run build:libs`
4. Make your changes
5. `npm run build` (full build)
6. `npm test` (verify changes)
7. `npm run lint` (check code quality)

### Working with Specific Packages

```bash
# Build specific package:
npm run build:server
npm run build:proxy
npm run build:cli

# Lint specific package:
npm run lint:common
npm run lint:server
npm run lint:components
```

### Development Server

```bash
npm run watch  # Starts Vite in watch mode + nodemon
# Server available at http://localhost:3000
```

### Documentation Updates

```bash
cd docs
npm start          # Development server
npm run build      # Production build
```

## Trust These Instructions

These instructions are based on comprehensive analysis of the codebase, successful testing of build/test/lint commands, and examination of CI/CD pipelines. **Only search for additional information if these instructions are incomplete or incorrect for your specific task.** The commands and workflows documented here have been validated and account for the major dependencies and timing requirements of this complex monorepo.

When in doubt, follow the exact command sequences provided, especially for bootstrap → build → test workflows which are critical for this repository's build system.
