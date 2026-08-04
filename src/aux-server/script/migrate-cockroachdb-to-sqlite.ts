/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Copies all of the data in a CockroachDB database into a SQLite database.
 *
 * Both databases are expected to already have all of their migrations applied.
 * This script only moves rows - it never modifies the schema of either database
 * and it never touches the `_prisma_migrations` bookkeeping table.
 *
 * Usage:
 *
 *   npm run migrate:cockroachdb-to-sqlite -- --source <url> --target <file>
 *
 * Run with `--help` for the list of options.
 */
import path from 'path';
import { readdirSync, readFileSync } from 'fs';
import { parseArgs } from 'node:util';
import prompts from 'prompts';

import {
    PrismaClient as SourcePrismaClient,
    Prisma as SourcePrisma,
} from '../aux-backend/prisma/generated';
import {
    PrismaClient as TargetPrismaClient,
    Prisma as TargetPrisma,
} from '../aux-backend/prisma/generated-sqlite';

/**
 * The fields that have been renamed between the CockroachDB schema and the
 * SQLite schema. Maps the model name to a map of source field name to target
 * field name.
 *
 * Every other field is expected to have the same name in both schemas.
 */
const FIELD_RENAMES: {
    [modelName: string]: { [sourceField: string]: string };
} = {
    BranchUpdate: {
        // `updated DateTime @updatedAt` in auth.prisma
        // vs `updatedAt Decimal` in auth.sqlite.prisma
        updated: 'updatedAt',
    },
};

/**
 * The maximum number of bound parameters that we are willing to put into a
 * single INSERT statement. SQLite's default SQLITE_MAX_VARIABLE_NUMBER is 32766,
 * so this leaves plenty of headroom.
 */
const MAX_PARAMETERS_PER_INSERT = 20000;

const SCHEMAS_DIRECTORY = path.resolve(__dirname, '../aux-backend/schemas');
const SQLITE_SCHEMA_DIRECTORY = path.resolve(SCHEMAS_DIRECTORY, 'sqlite');

/**
 * A field that should be copied from the source database to the target database.
 */
interface FieldPlan {
    sourceName: string;
    targetName: string;

    /**
     * Whether the target column requires a value.
     */
    targetRequired: boolean;

    /**
     * Whether the target column has a default value.
     * Required columns that have a default can be omitted instead of being set
     * to null.
     */
    targetHasDefault: boolean;

    /**
     * Converts a value read from the source database into a value that can be
     * written to the target database.
     */
    convert: (value: any) => any;
}

/**
 * A model that should be copied from the source database to the target database.
 */
interface ModelPlan {
    name: string;

    /**
     * The name of the property on the Prisma client for this model.
     * (i.e. `User` -> `user`)
     */
    property: string;

    /**
     * The names of the fields that make up the primary key of the model in the
     * source database. Used to read rows in stable pages.
     */
    primaryKeyFields: string[];

    /**
     * The names of the primary key fields in the target database.
     */
    targetPrimaryKeyFields: string[];

    fields: FieldPlan[];
}

interface Options {
    sourceUrl: string;
    targetUrl: string;
    truncate: boolean;
    skipDuplicates: boolean;
    only: string[] | null;
    exclude: string[];
    batchSize: number;
    dryRun: boolean;
    yes: boolean;
}

interface ModelResult {
    name: string;
    sourceCount: number;
    copied: number;
    duplicates: number;
    skipped: { missing: string[] }[];
}

const HELP = `
Copies all data from a CockroachDB database into a SQLite database.

Both databases must already have all of their migrations applied.

Usage:
  npm run migrate:cockroachdb-to-sqlite -- [options]

Options:
  --source <url>       The CockroachDB connection string to read from.
                       Defaults to $SOURCE_DATABASE_URL, then to the
                       DATABASE_URL found in aux-backend/schemas/*.env.json
  --target <file>      The SQLite database file to write to. May be given as a
                       plain path or as a file: URL.
                       Defaults to $TARGET_DATABASE_URL, then to the
                       DATABASE_URL found in aux-backend/schemas/sqlite/*.env.json
  --truncate           Delete all existing rows from the target database before
                       copying. Required if the target is not empty.
  --skip-duplicates    Append to the target database, leaving rows whose primary
                       key already exists alone. Required if the target is not
                       empty.
  --only <models>      Comma separated list of model names to copy.
  --exclude <models>   Comma separated list of model names to skip.
  --batch-size <n>     Number of rows to read and write at a time. (default 500)
  --dry-run            Report what would be copied without writing anything.
  --yes                Don't ask for confirmation before writing.
  --help               Show this message.

Only data stored in the Prisma schema is copied. Files in S3/MinIO, inst updates
cached in Redis, per-record user databases, MongoDB collections, and TigerBeetle
ledgers must be migrated separately.
`.trimStart();

async function main() {
    const options = parseOptions();

    const plans = buildPlans(options);
    const order = orderModels(plans);

    console.log('Source (CockroachDB):', redactUrl(options.sourceUrl));
    console.log('Target (SQLite):     ', options.targetUrl);
    console.log('Models:              ', order.length);
    console.log(
        'Mode:                ',
        options.dryRun
            ? 'dry run'
            : options.truncate
            ? 'delete existing rows, then copy'
            : options.skipDuplicates
            ? 'append, leaving existing rows alone'
            : 'copy into an empty database'
    );
    console.log('');

    const source = new SourcePrismaClient({
        datasources: { db: { url: options.sourceUrl } },
    });
    const target = new TargetPrismaClient({
        datasources: { db: { url: options.targetUrl } },
    });

    try {
        const nonEmpty = await findNonEmptyModels(target, order);

        if (options.dryRun) {
            await reportDryRun(source, order, nonEmpty);
            return;
        }

        if (
            nonEmpty.length > 0 &&
            !options.truncate &&
            !options.skipDuplicates
        ) {
            console.error(
                'The target database already contains data in the following tables:'
            );
            for (let { name, count } of nonEmpty) {
                console.error(`  ${name}: ${count} rows`);
            }
            console.error('');
            console.error(
                'Pass --truncate to delete the existing rows first, or --skip-duplicates to append to them.'
            );
            process.exitCode = 1;
            return;
        }

        if (!options.yes && !(await confirm(options, nonEmpty))) {
            console.log('Aborted.');
            return;
        }

        // Foreign keys have to be disabled while copying because the schema
        // contains cycles, which make it impossible to insert every row in an
        // order that satisfies every constraint:
        // - User.currentLoginRequestId <-> LoginRequest.userId
        // - Record.creditAccountId -> FinancialAccount.contractId ->
        //   ContractRecord.recordName -> Record.name
        await target.$executeRawUnsafe('PRAGMA foreign_keys = OFF');

        const results: ModelResult[] = [];
        try {
            if (options.truncate) {
                await truncate(target, order);
            }

            for (let plan of order) {
                results.push(await copyModel(source, target, plan, options));
            }
        } finally {
            await target.$executeRawUnsafe('PRAGMA foreign_keys = ON');
        }

        reportResults(results);

        const violations = await checkForeignKeys(target);
        if (violations === null) {
            console.log('');
            console.log('Done.');
            return;
        }

        if (violations.length > 0) {
            console.error('');
            console.error(
                `Found ${violations.length} foreign key violation(s) in the target database:`
            );
            for (let violation of violations.slice(0, 20)) {
                console.error('  ', JSON.stringify(violation, replaceBigInt));
            }
            if (violations.length > 20) {
                console.error(`   ...and ${violations.length - 20} more.`);
            }
            process.exitCode = 1;
            return;
        }

        console.log('');
        console.log('No foreign key violations. Done!');
    } finally {
        await source.$disconnect();
        await target.$disconnect();
    }
}

function parseOptions(): Options {
    const { values } = parseArgs({
        options: {
            source: { type: 'string' },
            target: { type: 'string' },
            truncate: { type: 'boolean', default: false },
            'skip-duplicates': { type: 'boolean', default: false },
            only: { type: 'string' },
            exclude: { type: 'string' },
            'batch-size': { type: 'string', default: '500' },
            'dry-run': { type: 'boolean', default: false },
            yes: { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
        allowPositionals: false,
    });

    if (values.help) {
        console.log(HELP);
        process.exit(0);
    }

    if (values.truncate && values['skip-duplicates']) {
        fail('--truncate and --skip-duplicates cannot be used together.');
    }

    const batchSize = Number(values['batch-size']);
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
        fail(
            `--batch-size must be a positive integer. Got "${values['batch-size']}".`
        );
    }

    const sourceUrl = resolveSourceUrl(values.source);
    const targetUrl = resolveTargetUrl(values.target);

    return {
        sourceUrl,
        targetUrl,
        truncate: !!values.truncate,
        skipDuplicates: !!values['skip-duplicates'],
        only: parseModelList(values.only),
        exclude: parseModelList(values.exclude) ?? [],
        batchSize,
        dryRun: !!values['dry-run'],
        yes: !!values.yes,
    };
}

function parseModelList(value: string | undefined): string[] | null {
    if (!value) {
        return null;
    }
    return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => !!v);
}

/**
 * Resolves the CockroachDB connection string that should be read from.
 * @param value The value that was given on the command line.
 */
function resolveSourceUrl(value: string | undefined): string {
    const url =
        value ??
        process.env.SOURCE_DATABASE_URL ??
        readDatabaseUrlFromEnvFiles(SCHEMAS_DIRECTORY);

    if (!url) {
        fail(
            'Unable to determine the CockroachDB connection string. Pass --source, or set SOURCE_DATABASE_URL.'
        );
    }

    if (!/^(postgres|postgresql|cockroachdb):\/\//.test(url)) {
        fail(
            `--source must be a postgresql:// connection string. Got "${redactUrl(
                url
            )}".`
        );
    }

    return url;
}

/**
 * Resolves the absolute file: URL of the SQLite database that should be written
 * to. Uses the same normalization that ServerBuilder applies when it constructs
 * a SQLite Prisma client.
 * @param value The value that was given on the command line.
 */
function resolveTargetUrl(value: string | undefined): string {
    const url =
        value ??
        process.env.TARGET_DATABASE_URL ??
        readDatabaseUrlFromEnvFiles(SQLITE_SCHEMA_DIRECTORY);

    if (!url) {
        fail(
            'Unable to determine the SQLite database file. Pass --target, or set TARGET_DATABASE_URL.'
        );
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^file:/i.test(url)) {
        fail(`--target must be a file path or a file: URL. Got "${url}".`);
    }

    const filePath = url.replace(/^file:(\/\/)?/i, '');
    if (!filePath) {
        fail(`--target must reference a SQLite file. Got "${url}".`);
    }

    return `file:${path.resolve(filePath)}`;
}

/**
 * Reads DATABASE_URL out of the *.env.json files in the given directory.
 *
 * This mirrors what listEnvironmentFiles()/loadEnvFiles() in
 * aux-backend/shared/EnvUtils.ts do (and what prisma.config.ts relies on), but
 * it is reimplemented here so that this script only needs the generated Prisma
 * clients - importing EnvUtils would require the aux-common package to have been
 * built first.
 *
 * @param directory The directory to look for environment files in.
 */
function readDatabaseUrlFromEnvFiles(directory: string): string | null {
    let files: string[];
    try {
        files = readdirSync(directory, { withFileTypes: true })
            .filter((f) => f.isFile() && f.name.endsWith('.env.json'))
            .map((f) => path.join(directory, f.name))
            .sort();
    } catch (err) {
        return null;
    }

    let url: string | null = null;
    for (let file of files) {
        try {
            const parsed = JSON.parse(
                readFileSync(file, { encoding: 'utf-8' })
            );
            if (typeof parsed?.DATABASE_URL === 'string') {
                url = parsed.DATABASE_URL;
            }
        } catch (err) {
            console.warn(`Unable to read ${file}:`, err);
        }
    }

    return url;
}

/**
 * Builds the list of models that should be copied by comparing the datamodel of
 * the CockroachDB client against the datamodel of the SQLite client.
 * @param options The options for the migration.
 */
function buildPlans(options: Options): ModelPlan[] {
    const sourceModels = getSourceModels();
    const targetModels = getTargetModels();

    const targetModelsByName = new Map<string, any>(
        targetModels.map((m) => [m.name, m])
    );
    const sourceModelNames = new Set<string>(sourceModels.map((m) => m.name));

    const missingFromTarget = sourceModels
        .filter((m) => !targetModelsByName.has(m.name))
        .map((m) => m.name);
    const missingFromSource = targetModels
        .filter((m) => !sourceModelNames.has(m.name))
        .map((m) => m.name);

    if (missingFromTarget.length > 0 || missingFromSource.length > 0) {
        fail(
            'The CockroachDB and SQLite schemas do not contain the same models. ' +
                'They need to be brought back in sync before data can be migrated.\n' +
                (missingFromTarget.length > 0
                    ? `  Missing from auth.sqlite.prisma: ${missingFromTarget.join(
                          ', '
                      )}\n`
                    : '') +
                (missingFromSource.length > 0
                    ? `  Missing from auth.prisma: ${missingFromSource.join(
                          ', '
                      )}`
                    : '')
        );
    }

    for (let name of [...(options.only ?? []), ...options.exclude]) {
        if (!sourceModelNames.has(name)) {
            fail(
                `"${name}" is not a model in the schema. Known models:\n  ${sourceModels
                    .map((m) => m.name)
                    .join(', ')}`
            );
        }
    }

    const only = options.only ? new Set(options.only) : null;
    const exclude = new Set(options.exclude);

    const plans: ModelPlan[] = [];
    for (let sourceModel of sourceModels) {
        if (only && !only.has(sourceModel.name)) {
            continue;
        }
        if (exclude.has(sourceModel.name)) {
            continue;
        }
        plans.push(
            buildModelPlan(
                sourceModel,
                targetModelsByName.get(sourceModel.name)
            )
        );
    }

    if (plans.length <= 0) {
        fail('No models were selected to copy.');
    }

    return plans;
}

function getSourceModels(): any[] {
    return getModels(
        SourcePrisma,
        'aux-backend/prisma/generated',
        'prisma:generate'
    );
}

function getTargetModels(): any[] {
    return getModels(
        TargetPrisma,
        'aux-backend/prisma/generated-sqlite',
        'prisma:generate:sqlite'
    );
}

/**
 * Gets the list of models in the datamodel of the given generated Prisma
 * namespace.
 * @param prisma The Prisma namespace from a generated client.
 * @param location The location of the client. Used for error messages.
 * @param script The npm script that generates the client.
 */
function getModels(prisma: any, location: string, script: string): any[] {
    const models = prisma?.dmmf?.datamodel?.models;
    if (!Array.isArray(models) || models.length <= 0) {
        fail(
            `Unable to read the datamodel from ${location}. ` +
                `Run \`pnpm --filter @casual-simulation/aux-server run ${script}\` to generate the Prisma client.`
        );
    }
    return models;
}

/**
 * Builds the plan for copying a single model.
 * @param sourceModel The model from the CockroachDB datamodel.
 * @param targetModel The model from the SQLite datamodel.
 */
function buildModelPlan(sourceModel: any, targetModel: any): ModelPlan {
    const renames = FIELD_RENAMES[sourceModel.name] ?? {};
    const targetFields = new Map<string, any>(
        targetModel.fields
            .filter((f: any) => f.kind !== 'object')
            .map((f: any) => [f.name, f])
    );

    const fields: FieldPlan[] = [];
    for (let sourceField of sourceModel.fields) {
        // Relation fields aren't columns. The scalar columns that back them
        // (i.e. `userId`) are separate fields and get copied on their own.
        if (sourceField.kind === 'object') {
            continue;
        }

        const targetName = renames[sourceField.name] ?? sourceField.name;
        const targetField = targetFields.get(targetName);

        if (!targetField) {
            fail(
                `${sourceModel.name}.${sourceField.name} does not exist in the SQLite schema. ` +
                    'Add it to auth.sqlite.prisma, or add a rename to FIELD_RENAMES in this script.'
            );
        }

        fields.push({
            sourceName: sourceField.name,
            targetName: targetName,
            targetRequired: !!targetField.isRequired,
            targetHasDefault: !!targetField.hasDefaultValue,
            convert: getConverter(sourceModel.name, sourceField, targetField),
        });
    }

    const primaryKeyFields = getPrimaryKeyFields(sourceModel);

    return {
        name: sourceModel.name,
        property: clientPropertyName(sourceModel.name),
        primaryKeyFields,
        targetPrimaryKeyFields: primaryKeyFields.map((f) => renames[f] ?? f),
        fields,
    };
}

/**
 * Gets the function that converts a value of the given source field into a value
 * that can be written to the given target field.
 * @param modelName The name of the model. Used for error messages.
 * @param sourceField The field from the CockroachDB datamodel.
 * @param targetField The field from the SQLite datamodel.
 */
function getConverter(
    modelName: string,
    sourceField: any,
    targetField: any
): (value: any) => any {
    const sourceType: string = sourceField.type;
    const targetType: string = targetField.type;

    // Json columns can't be set to `null` through Prisma - it wants either
    // Prisma.DbNull (a SQL NULL) or Prisma.JsonNull (the JSON value `null`).
    // A required column can only hold the latter.
    const nullValue =
        targetType !== 'Json'
            ? null
            : targetField.isRequired
            ? TargetPrisma.JsonNull
            : TargetPrisma.DbNull;

    if (sourceField.isList !== targetField.isList) {
        // String[] columns in CockroachDB are stored as JSON arrays in SQLite.
        if (sourceField.isList && targetType === 'Json') {
            return (value) => value ?? nullValue;
        }
        fail(
            `Don't know how to convert ${modelName}.${sourceField.name} from ` +
                `${sourceType}${sourceField.isList ? '[]' : ''} to ` +
                `${targetType}${targetField.isList ? '[]' : ''}.`
        );
    }

    if (sourceType === targetType) {
        return targetType === 'Json' ? (value) => value ?? nullValue : identity;
    }

    // DateTime columns in CockroachDB are stored as epoch milliseconds in
    // SQLite. This matches convertToMillis() in aux-backend/prisma/Utils.ts.
    if (sourceType === 'DateTime' && targetType === 'Decimal') {
        return (value) => (value == null ? null : Number(value));
    }

    fail(
        `Don't know how to convert ${modelName}.${sourceField.name} from ${sourceType} to ${targetType}.`
    );
}

function identity(value: any): any {
    return value;
}

/**
 * Gets the names of the fields that make up the primary key of the given model.
 * @param model The model from a Prisma datamodel.
 */
function getPrimaryKeyFields(model: any): string[] {
    if (model.primaryKey?.fields?.length > 0) {
        return model.primaryKey.fields;
    }

    const id = model.fields.find((f: any) => f.isId);
    if (id) {
        return [id.name];
    }

    fail(
        `${model.name} does not have a primary key, so its rows cannot be read in a stable order. ` +
            'Exclude it with --exclude.'
    );
}

/**
 * Gets the name of the property on the Prisma client for the given model.
 * Prisma lowercases the first character of the model name.
 * (i.e. `OpenIDLoginRequest` -> `openIDLoginRequest`)
 * @param modelName The name of the model.
 */
function clientPropertyName(modelName: string): string {
    return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/**
 * Sorts the given models so that a model always comes after the models that it
 * references. Cycles are broken arbitrarily - foreign keys are disabled while
 * copying so that the cycles in the schema don't prevent inserts.
 * @param plans The models to sort.
 */
function orderModels(plans: ModelPlan[]): ModelPlan[] {
    const plansByName = new Map(plans.map((p) => [p.name, p]));
    const dependencies = new Map<string, string[]>();

    for (let model of getTargetModels()) {
        if (!plansByName.has(model.name)) {
            continue;
        }
        const deps = new Set<string>();
        for (let field of model.fields) {
            if (
                field.kind === 'object' &&
                field.relationFromFields?.length > 0 &&
                field.type !== model.name &&
                plansByName.has(field.type)
            ) {
                deps.add(field.type);
            }
        }
        dependencies.set(model.name, [...deps].sort());
    }

    const order: ModelPlan[] = [];
    const state = new Map<string, 'visiting' | 'visited'>();

    const visit = (name: string) => {
        if (state.has(name)) {
            // Already ordered, or we found a cycle and have to give up on
            // ordering this edge.
            return;
        }
        state.set(name, 'visiting');
        for (let dep of dependencies.get(name) ?? []) {
            visit(dep);
        }
        state.set(name, 'visited');
        order.push(plansByName.get(name)!);
    };

    for (let plan of plans) {
        visit(plan.name);
    }

    return order;
}

/**
 * Gets the models in the target database that already have rows in them.
 * @param target The SQLite client.
 * @param plans The models to check.
 */
async function findNonEmptyModels(
    target: TargetPrismaClient,
    plans: ModelPlan[]
): Promise<{ name: string; count: number }[]> {
    const nonEmpty: { name: string; count: number }[] = [];
    for (let plan of plans) {
        const count = await collection(target, plan).count();
        if (count > 0) {
            nonEmpty.push({ name: plan.name, count });
        }
    }
    return nonEmpty;
}

/**
 * Deletes all of the rows in the target database, in reverse dependency order.
 * @param target The SQLite client.
 * @param plans The models to delete rows from, in dependency order.
 */
async function truncate(target: TargetPrismaClient, plans: ModelPlan[]) {
    console.log('Deleting existing rows from the target database...');
    let total = 0;
    for (let plan of [...plans].reverse()) {
        const { count } = await collection(target, plan).deleteMany({});
        total += count;
    }
    console.log(`Deleted ${total} row(s).`);
    console.log('');
}

/**
 * Copies all of the rows of the given model from the source database to the
 * target database.
 * @param source The CockroachDB client.
 * @param target The SQLite client.
 * @param plan The model to copy.
 * @param options The options for the migration.
 */
async function copyModel(
    source: SourcePrismaClient,
    target: TargetPrismaClient,
    plan: ModelPlan,
    options: Options
): Promise<ModelResult> {
    const sourceCollection = collection(source, plan);
    const targetCollection = collection(target, plan);

    const sourceCount: number = await sourceCollection.count();
    const result: ModelResult = {
        name: plan.name,
        sourceCount,
        copied: 0,
        duplicates: 0,
        skipped: [],
    };

    if (sourceCount <= 0) {
        reportProgress(plan.name, 0, 0, true);
        return result;
    }

    // Read rows in pages ordered by the primary key. Keyset pagination is used
    // instead of skip/take so that large tables (i.e. BranchUpdate) don't get
    // slower and slower as the copy progresses.
    const orderBy = plan.primaryKeyFields.map((f) => ({ [f]: 'asc' }));
    const rowsPerInsert = Math.max(
        1,
        Math.min(
            options.batchSize,
            Math.floor(
                MAX_PARAMETERS_PER_INSERT / Math.max(1, plan.fields.length)
            )
        )
    );

    let cursor: any = null;
    let read = 0;
    while (true) {
        const rows: any[] = await sourceCollection.findMany({
            where: cursor
                ? keysetFilter(plan.primaryKeyFields, cursor)
                : undefined,
            orderBy,
            take: options.batchSize,
        });

        if (rows.length <= 0) {
            break;
        }

        read += rows.length;
        cursor = rows[rows.length - 1];

        let converted: any[] = [];
        for (let row of rows) {
            const { data, missing } = convertRow(plan, row);
            if (missing.length > 0) {
                result.skipped.push({ missing });
            } else {
                converted.push(data);
            }
        }

        if (options.skipDuplicates && converted.length > 0) {
            const existing = await findExistingKeys(
                targetCollection,
                plan,
                converted
            );
            if (existing.size > 0) {
                const before = converted.length;
                converted = converted.filter(
                    (row) => !existing.has(primaryKeyOf(plan, row))
                );
                result.duplicates += before - converted.length;
            }
        }

        for (let i = 0; i < converted.length; i += rowsPerInsert) {
            const chunk = converted.slice(i, i + rowsPerInsert);
            const { count } = await targetCollection.createMany({
                data: chunk,
            });
            result.copied += count;
        }

        reportProgress(plan.name, read, sourceCount);

        if (rows.length < options.batchSize) {
            break;
        }
    }

    reportProgress(plan.name, read, sourceCount, true);
    return result;
}

/**
 * Converts a row from the source database into a row that can be written to the
 * target database.
 * @param plan The model that the row belongs to.
 * @param row The row that was read from the source database.
 */
function convertRow(
    plan: ModelPlan,
    row: any
): { data: any; missing: string[] } {
    const data: any = {};
    const missing: string[] = [];

    for (let field of plan.fields) {
        const value = field.convert(row[field.sourceName]);
        if (value == null && field.targetRequired) {
            if (field.targetHasDefault) {
                // Let the target database fill the column in.
                continue;
            }
            // The SQLite schema requires a value that the CockroachDB schema
            // allows to be null (i.e. Invoice.subscriptionId), so the row can't
            // be inserted.
            missing.push(field.targetName);
            continue;
        }
        data[field.targetName] = value;
    }

    return { data, missing };
}

/**
 * Gets the set of primary keys from the given rows that already exist in the
 * target database.
 * @param targetCollection The delegate for the model on the SQLite client.
 * @param plan The model that the rows belong to.
 * @param rows The converted rows that are about to be inserted.
 */
async function findExistingKeys(
    targetCollection: any,
    plan: ModelPlan,
    rows: any[]
): Promise<Set<string>> {
    const fields = plan.targetPrimaryKeyFields;
    const select = Object.fromEntries(fields.map((f) => [f, true]));
    const existing: any[] = await targetCollection.findMany({
        where: {
            OR: rows.map((row) =>
                Object.fromEntries(fields.map((f) => [f, row[f]]))
            ),
        },
        select,
    });

    return new Set(existing.map((row) => primaryKeyOf(plan, row)));
}

/**
 * Gets a string that uniquely identifies the given row by its primary key.
 * @param plan The model that the row belongs to.
 * @param row The row. Must use the target field names.
 */
function primaryKeyOf(plan: ModelPlan, row: any): string {
    return plan.targetPrimaryKeyFields
        .map((f) => String(row[f]))
        .join('\u0000');
}

/**
 * Builds a filter that matches every row that sorts after the given row when
 * ordered by the given fields ascending.
 *
 * For the fields [a, b] this produces:
 *   OR: [{ a: { gt: row.a } }, { a: row.a, b: { gt: row.b } }]
 *
 * @param fields The fields that the rows are ordered by.
 * @param row The last row of the previous page.
 */
function keysetFilter(fields: string[], row: any): any {
    const or: any[] = [];
    for (let i = 0; i < fields.length; i++) {
        const clause: any = {};
        for (let j = 0; j < i; j++) {
            clause[fields[j]] = row[fields[j]];
        }
        clause[fields[i]] = { gt: row[fields[i]] };
        or.push(clause);
    }
    return or.length === 1 ? or[0] : { OR: or };
}

/**
 * Gets the delegate on the given Prisma client for the given model.
 * @param client The Prisma client.
 * @param plan The model.
 */
function collection(client: any, plan: ModelPlan): any {
    const delegate = client[plan.property];
    if (!delegate) {
        fail(
            `The Prisma client does not have a "${plan.property}" property for the ${plan.name} model.`
        );
    }
    return delegate;
}

/**
 * Checks the target database for foreign key violations.
 * Returns null if the check could not be run.
 * @param target The SQLite client.
 */
async function checkForeignKeys(
    target: TargetPrismaClient
): Promise<any[] | null> {
    try {
        const violations = await target.$queryRawUnsafe<any[]>(
            'PRAGMA foreign_key_check'
        );
        return Array.isArray(violations) ? violations : [];
    } catch (err) {
        console.warn('');
        console.warn(
            'Unable to run PRAGMA foreign_key_check on the target database:',
            err
        );
        return null;
    }
}

async function reportDryRun(
    source: SourcePrismaClient,
    plans: ModelPlan[],
    nonEmpty: { name: string; count: number }[]
) {
    const nonEmptyByName = new Map(nonEmpty.map((n) => [n.name, n.count]));
    const rows: string[][] = [['Model', 'Source', 'Target']];
    let sourceTotal = 0;
    let targetTotal = 0;

    for (let plan of plans) {
        const count: number = await collection(source, plan).count();
        const targetCount = nonEmptyByName.get(plan.name) ?? 0;
        sourceTotal += count;
        targetTotal += targetCount;
        rows.push([plan.name, String(count), String(targetCount)]);
    }

    rows.push(['TOTAL', String(sourceTotal), String(targetTotal)]);
    printTable(rows);
    console.log('');
    console.log('Dry run - nothing was written.');
}

function reportResults(results: ModelResult[]) {
    const rows: string[][] = [
        ['Model', 'Source', 'Copied', 'Duplicate', 'Skipped'],
    ];
    let sourceTotal = 0;
    let copiedTotal = 0;
    let duplicateTotal = 0;
    let skippedTotal = 0;

    for (let result of results) {
        sourceTotal += result.sourceCount;
        copiedTotal += result.copied;
        duplicateTotal += result.duplicates;
        skippedTotal += result.skipped.length;
        rows.push([
            result.name,
            String(result.sourceCount),
            String(result.copied),
            String(result.duplicates),
            String(result.skipped.length),
        ]);
    }

    rows.push([
        'TOTAL',
        String(sourceTotal),
        String(copiedTotal),
        String(duplicateTotal),
        String(skippedTotal),
    ]);

    console.log('');
    printTable(rows);

    const skipped = results.filter((r) => r.skipped.length > 0);
    if (skipped.length > 0) {
        console.log('');
        console.warn(
            'Some rows could not be copied because the SQLite schema requires a value that was null in CockroachDB:'
        );
        for (let result of skipped) {
            const missing = [
                ...new Set(result.skipped.flatMap((s) => s.missing)),
            ];
            console.warn(
                `  ${result.name}: ${
                    result.skipped.length
                } row(s) missing ${missing.join(', ')}`
            );
        }
    }

    const mismatched = results.filter(
        (r) => r.copied + r.duplicates + r.skipped.length !== r.sourceCount
    );
    if (mismatched.length > 0) {
        console.log('');
        console.warn(
            'Some models did not account for every source row. Rows may have been lost:'
        );
        for (let result of mismatched) {
            console.warn(
                `  ${result.name}: ${result.sourceCount} in source, ${result.copied} copied, ${result.duplicates} duplicate, ${result.skipped.length} skipped`
            );
        }
    }
}

function printTable(rows: string[][]) {
    const widths = rows[0].map((_, i) =>
        Math.max(...rows.map((r) => (r[i] ?? '').length))
    );
    for (let row of rows) {
        console.log(
            row
                .map((cell, i) =>
                    i === 0
                        ? (cell ?? '').padEnd(widths[i])
                        : (cell ?? '').padStart(widths[i])
                )
                .join('  ')
                .trimEnd()
        );
    }
}

const PROGRESS_WIDTH = 72;

function reportProgress(
    name: string,
    done: number,
    total: number,
    final = false
) {
    const message = `  ${name}: ${done}/${total}`;
    if (!process.stdout.isTTY) {
        if (final) {
            console.log(message);
        }
        return;
    }

    if (final) {
        process.stdout.write(`\r${message.padEnd(PROGRESS_WIDTH)}\n`);
    } else {
        process.stdout.write(`\r${message.padEnd(PROGRESS_WIDTH)}`);
    }
}

async function confirm(
    options: Options,
    nonEmpty: { name: string; count: number }[]
): Promise<boolean> {
    if (options.truncate && nonEmpty.length > 0) {
        const rows = nonEmpty.reduce((total, n) => total + n.count, 0);
        console.log(
            `The target database contains ${rows} row(s) across ${nonEmpty.length} table(s). They will be deleted.`
        );
    }

    const response = await prompts({
        type: 'confirm',
        name: 'confirmed',
        message: `Copy data into ${options.targetUrl}?`,
        initial: false,
    });

    return response.confirmed === true;
}

/**
 * Removes the password from the given connection string so that it can be
 * printed.
 * @param url The connection string.
 */
function redactUrl(url: string): string {
    return url.replace(/^([a-z+]+:\/\/[^:/@]+):[^@]*@/i, '$1:****@');
}

function replaceBigInt(key: string, value: any): any {
    return typeof value === 'bigint' ? value.toString() : value;
}

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

main().catch((err) => {
    console.error('');
    console.error(err);
    process.exit(1);
});
