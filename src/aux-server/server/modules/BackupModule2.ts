import { AuxModule2, Simulation, AuxUser } from '@casual-simulation/aux-vm';
import { DeviceInfo, remote } from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap, map } from 'rxjs/operators';
import { BackupToGithubAction, merge } from '@casual-simulation/aux-common';
import { nodeSimulationForBranch } from '@casual-simulation/aux-vm-node';
import Octokit from '@octokit/rest';
import {
    BackupAsDownloadAction,
    download,
    BackupOptions,
} from '@casual-simulation/aux-common/bots';
import JSZip from 'jszip';
import { CausalRepoClient } from '@casual-simulation/causal-trees/core2';

export type OctokitFactory = (auth: string) => Octokit;

/**
 * Defines an module that adds Github-related functionality.
 */
export class BackupModule2 implements AuxModule2 {
    private _octokitFactory: OctokitFactory;
    private _user: AuxUser;
    private _client: CausalRepoClient;

    constructor(
        user: AuxUser,
        client: CausalRepoClient,
        factory?: OctokitFactory
    ) {
        this._user = user;
        this._client = client;
        this._octokitFactory =
            factory ||
            (auth =>
                new Octokit({
                    auth,
                }));
    }

    async setup(simulation: Simulation): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            simulation.localEvents
                .pipe(
                    flatMap(async local => {
                        if (local.type === 'backup_to_github') {
                            await backupToGithub(
                                simulation,
                                local,
                                this._octokitFactory,
                                (id: string) =>
                                    nodeSimulationForBranch(
                                        this._user,
                                        this._client,
                                        id,
                                        {
                                            readOnly: true,
                                        }
                                    ),
                                this._client
                            );
                        } else if (local.type === 'backup_as_download') {
                            await backupAsDownload(
                                simulation,
                                local,
                                (id: string) =>
                                    nodeSimulationForBranch(
                                        this._user,
                                        this._client,
                                        id,
                                        {
                                            readOnly: true,
                                        }
                                    ),
                                this._client
                            );
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }

    async deviceConnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {}

    async deviceDisconnected(
        simulation: Simulation,
        device: DeviceInfo
    ): Promise<void> {}
}

async function backupAsDownload(
    simulation: Simulation,
    event: BackupAsDownloadAction,
    simulationFactory: (branch: string) => Simulation,
    client: CausalRepoClient
) {
    console.log('[BackupModule2] Backing up all channels as a download');
    const options = calculateOptions(event.options);
    const branches = await client
        .branches()
        .pipe(map(e => e.branches))
        .toPromise();

    const time = new Date(Date.now()).toISOString();
    const botId = await simulation.helper.createBot(undefined, {
        auxRunningTasks: true,
        auxTaskBackup: true,
        auxTaskBackupType: 'download',
        auxTaskOutput: 'Preparing...',
        progressBar: 0,
        auxProgressBarColor: '#FCE24C',
        auxTaskTime: time,
    });
    const bot = simulation.helper.botsState[botId];

    try {
        let zip = new JSZip();
        let index = 0;
        for (let id of branches) {
            const sim = simulationFactory(id);
            try {
                await sim.init();

                const data = await sim.export();
                const json = JSON.stringify(data);
                zip.file(`${id}.aux`, json);

                index += 1;
                let percent = (index / branches.length) * 0.8;
                await simulation.helper.updateBot(bot, {
                    tags: {
                        progressBar: percent,
                    },
                });
            } finally {
                sim.unsubscribe();
            }
        }

        const buffer = await zip.generateAsync({
            type: 'arraybuffer',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 9,
            },
        });

        await simulation.helper.updateBot(bot, {
            tags: {
                auxRunningTasks: null,
                auxFinishedTasks: true,
                auxTaskOutput: `Downloaded ${branches.length} channels.`,
                progressBar: 1,
                auxProgressBarColor: '#00FF00',
            },
        });

        await simulation.helper.transaction(
            remote(
                download(buffer, 'backup.zip', 'application/zip'),
                event.target
            )
        );
    } catch (err) {
        console.error('[BackupModule2]', err.toString());
        await simulation.helper.updateBot(bot, {
            tags: {
                auxRunningTasks: null,
                auxFinishedTasks: true,
                auxTaskOutput: 'The task failed.',
                auxTaskError: err.toString(),
                progressBar: 1,
                auxProgressBarColor: '#FF0000',
            },
        });
    }
}

async function backupToGithub(
    simulation: Simulation,
    event: BackupToGithubAction,
    factory: OctokitFactory,
    simulationFactory: (branch: string) => Simulation,
    client: CausalRepoClient
) {
    console.log('[BackupModule2] Backing up all channels to Github');
    const options = calculateOptions(event.options);
    const branches = await client
        .branches()
        .pipe(map(e => e.branches))
        .toPromise();

    const time = new Date(Date.now()).toISOString();
    const botId = await simulation.helper.createBot(undefined, {
        auxRunningTasks: true,
        auxTaskBackup: true,
        auxTaskBackupType: 'github',
        auxTaskOutput: 'Uploading...',
        progressBar: 0,
        auxProgressBarColor: '#FCE24C',
        auxTaskTime: time,
    });
    const bot = simulation.helper.botsState[botId];

    let gistFiles: any = {};
    let index = 0;
    for (let id of branches) {
        const sim = simulationFactory(id);
        try {
            await sim.init();
            const data = await sim.export();
            gistFiles[`${id}.aux`] = {
                content: JSON.stringify(data),
            };

            index += 1;

            let percent = (index / branches.length) * 0.8;
            await simulation.helper.updateBot(bot, {
                tags: {
                    progressBar: percent,
                },
            });
        } finally {
            sim.unsubscribe();
        }
    }

    try {
        const octokit = factory(event.auth);
        const response = await octokit.gists.create({
            files: gistFiles,
            description: `Backup from ${time}`,
        });

        await simulation.helper.updateBot(bot, {
            tags: {
                auxRunningTasks: null,
                auxFinishedTasks: true,
                auxTaskOutput: `Uploaded ${branches.length} channels.`,
                auxTaskBackupUrl: response.data.html_url,
                progressBar: 1,
                auxProgressBarColor: '#00FF00',
            },
        });

        console.log('[BackupModule2] Channels backed up!');
    } catch (err) {
        console.error('[BackupModule2]', err.toString());
        await simulation.helper.updateBot(bot, {
            tags: {
                auxRunningTasks: null,
                auxFinishedTasks: true,
                auxTaskOutput: 'The task failed.',
                auxTaskError: err.toString(),
                progressBar: 1,
                auxProgressBarColor: '#FF0000',
            },
        });
    }
}

function calculateOptions(options: BackupOptions): BackupOptions {
    return merge<BackupOptions, BackupOptions>(
        {
            includeArchived: true,
        },
        options || {}
    );
}
