import {
    CausalRepoStore,
    CausalObjectStore,
    CausalRepoObject,
    CausalRepoBranch,
    loadBranch,
    storeData,
    repoAtom,
    CausalRepoCommit,
    loadCommit,
    CommitData,
} from '@casual-simulation/causal-trees';
import Progress from 'cli-progress';

import { sortBy } from 'lodash';
import { prompt } from 'inquirer';
import { mongoConnectionInfo } from './mongodb';
import { cassandraAndMongoDBConnectionInfo } from './cassandradb';

export async function migrateMenu() {
    const sourceAnswer = await prompt({
        type: 'list',
        name: 'source',
        message: 'Where do you want to migrate from?',
        choices: ['MongoDB'],
    });

    const source = await connectionInfo(sourceAnswer.source);

    const destinationAnswer = await prompt({
        type: 'list',
        name: 'destination',
        message: 'Where do you want to migrate to?',
        choices: ['MongoDB', 'CassandraDB+MongoDB'],
    });

    const destination = await connectionInfo(destinationAnswer.destination);

    await migrate(source, destination);
}

async function migrate(
    source: MigrationSource,
    destination: MigrationDestination
) {
    if (isRepoStore(source)) {
        const allBranches = await source.getBranches(null);
        const validBranches = allBranches.filter((b) => !!b && !!b.hash);
        const sortedBranches = sortBy(validBranches, (b) => b.name);

        const branchesAnswer = await prompt({
            type: 'checkbox',
            name: 'branches',
            message: 'Select the branches to migrate',
            choices: sortedBranches.map((b) => ({
                name: `${b.name} (${b.hash.substring(0, 6)})`,
                checked: true,
                value: b,
            })),
        });

        const selectedBranches: CausalRepoBranch[] = branchesAnswer.branches;

        const progress = new Progress.MultiBar({
            clearOnComplete: true,
        });
        let results = [] as BranchMigrationResult[];

        for (let branch of selectedBranches) {
            results.push(
                await migrateBranch(branch, source, destination, progress)
            );
        }

        progress.stop();

        console.log('\n');
        let succeeded = 0;
        let failed = 0;
        const total = selectedBranches.length;
        for (let i = 0; i < selectedBranches.length; i++) {
            const branch = selectedBranches[i];
            const result = results[i];

            if (result.error) {
                failed += 1;
                console.log(`❌ ${branch.name}: ${result.error.toString()}`);
            } else {
                succeeded += 1;
                console.log(
                    `✔ ${branch.name}: ${result.numberOfObjectsMigrated} objects migrated`
                );
            }
        }

        console.log('Summary');
        console.log(`${succeeded} Succeeded`);
        console.log(`${failed} Failed`);
        console.log(`${total} Total`);
    } else {
        throw new Error(
            'It is currently not supported to migrate from a system that cannot list all the available branches.'
        );
    }
}

async function migrateBranch(
    branch: CausalRepoBranch,
    source: CausalObjectStore,
    destination: CausalRepoStore,
    progress: Progress.MultiBar
): Promise<BranchMigrationResult> {
    const bar = progress.create(100, 0, {
        format: `${branch.name}: [{bar}] {percentage}% | {value}/{total}`,
    });
    try {
        let totalObjects = 0;

        const data = await loadBranch(source, branch);

        if (!data) {
            return {
                error: null,
                numberOfObjectsMigrated: 0,
            };
        }

        await _storeBranch(branch);
        bar.increment();

        totalObjects += await _storeCommit(data);
        bar.increment();

        let currentCommit = await _previousCommit(data.commit);
        while (currentCommit) {
            const loaded = await loadCommit(source, branch.name, currentCommit);

            totalObjects += await _storeCommit(loaded);
            bar.increment();

            currentCommit = await _previousCommit(currentCommit);
        }

        bar.update(bar.getTotal());
        return {
            error: null,
            numberOfObjectsMigrated: totalObjects,
        };
    } catch (err) {
        bar.stop();
        return {
            error: err,
            numberOfObjectsMigrated: 0,
        };
    }

    async function _previousCommit(
        commit: CausalRepoCommit
    ): Promise<CausalRepoCommit> {
        if (commit.previousCommit) {
            return (await source.getObject(
                commit.previousCommit
            )) as CausalRepoCommit;
        } else {
            return null;
        }
    }

    async function _storeCommit(loaded: CommitData) {
        const atoms = [...loaded.atoms.values()];
        const objs: CausalRepoObject[] = [
            loaded.commit,
            loaded.index,
            ...atoms.map(repoAtom),
        ];
        await destination.storeObjects(branch.name, objs);

        return atoms.length + 2;
    }

    async function _storeBranch(branch: CausalRepoBranch) {
        await destination.saveBranch({
            hash: branch.hash,
            name: branch.name,
            type: branch.type,
        });
    }
}

function isRepoStore(obj: MigrationSource): obj is CausalRepoStore {
    return 'getBranches' in obj;
}

interface BranchMigrationResult {
    error: Error;
    numberOfObjectsMigrated: number;
}

type MigrationSource = CausalRepoStore;
type MigrationDestination = CausalRepoStore;

type ConnectionType = 'MongoDB' | 'CassandraDB+MongoDB';

async function connectionInfo(
    connectionType: ConnectionType
): Promise<CausalRepoStore> {
    if (connectionType === 'MongoDB') {
        return mongoConnectionInfo();
    } else {
        return cassandraAndMongoDBConnectionInfo();
    }
}
