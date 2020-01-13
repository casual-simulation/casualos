import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    DeviceInfo,
    remote,
    SESSION_ID_CLAIM,
    CausalTreeStore,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    calculateBotValue,
    AuxBot,
    ShellAction,
    getChannelBotById,
    LocalActions,
    EchoAction,
    action,
    BackupToGithubAction,
    merge,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel, isAdminChannel } from '@casual-simulation/aux-vm-node';
import Octokit from '@octokit/rest';
import {
    getBotChannel,
    botsInDimension,
    BackupAsDownloadAction,
    download,
    BackupOptions,
} from '@casual-simulation/aux-common/bots';
import { getChannelIds } from './BackupHelpers';
import JSZip from 'jszip';

export type OctokitFactory = (auth: string) => Octokit;

/**
 * Defines an module that adds Github-related functionality.
 */
export class BackupModule implements AuxModule {
    private _octokitFactory: OctokitFactory;
    private _store: CausalTreeStore;

    constructor(store: CausalTreeStore, factory?: OctokitFactory) {
        this._store = store;
        this._octokitFactory =
            factory ||
            (auth =>
                new Octokit({
                    auth,
                }));
    }

    async setup(
        info: RealtimeChannelInfo,
        channel: NodeAuxChannel
    ): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            channel.onLocalEvents
                .pipe(
                    flatMap(e => e),
                    flatMap(async local => {
                        if (local.type === 'backup_to_github') {
                            await backupToGithub(
                                info,
                                channel,
                                local,
                                this._octokitFactory,
                                this._store
                            );
                        } else if (local.type === 'backup_as_download') {
                            await backupAsDownload(
                                info,
                                channel,
                                local,
                                this._store
                            );
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }

    async deviceConnected(
        info: RealtimeChannelInfo,
        channel: AuxChannel,
        device: DeviceInfo
    ): Promise<void> {}

    async deviceDisconnected(
        info: RealtimeChannelInfo,
        channel: AuxChannel,
        device: DeviceInfo
    ): Promise<void> {}
}

async function backupAsDownload(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
    event: BackupAsDownloadAction,
    store: CausalTreeStore
) {
    console.log('[BackupModule] Backing up all channels as a download');
    const options = calculateOptions(event.options);
    const channels = await store.getTreeIds();

    const time = new Date(Date.now()).toISOString();
    const botId = await channel.helper.createBot(undefined, {
        auxRunningTasks: true,
        auxTaskBackup: true,
        auxTaskBackupType: 'download',
        auxTaskOutput: 'Preparing...',
        auxProgressBar: 0,
        auxProgressBarColor: '#FCE24C',
        auxTaskTime: time,
    });
    const bot = channel.helper.botsState[botId];

    try {
        let zip = new JSZip();
        let index = 0;
        for (let id of channels) {
            const stored = await store.get(
                id,
                options.includeArchived ? undefined : false
            );
            const json = JSON.stringify(stored);
            zip.file(`${id}.aux`, json);

            index += 1;
            let percent = (index / channels.length) * 0.8;
            await channel.helper.updateBot(bot, {
                tags: {
                    auxProgressBar: percent,
                },
            });
        }

        const buffer = await zip.generateAsync({
            type: 'arraybuffer',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 9,
            },
        });

        await channel.helper.updateBot(bot, {
            tags: {
                auxRunningTasks: null,
                auxFinishedTasks: true,
                auxTaskOutput: `Downloaded ${channels.length} channels.`,
                auxProgressBar: 1,
                auxProgressBarColor: '#00FF00',
            },
        });

        await channel.sendEvents([
            remote(
                download(buffer, 'backup.zip', 'application/zip'),
                event.target
            ),
        ]);
    } catch (err) {
        console.error('[BackupModule]', err.toString());
        await channel.helper.updateBot(bot, {
            tags: {
                auxRunningTasks: null,
                auxFinishedTasks: true,
                auxTaskOutput: 'The task failed.',
                auxTaskError: err.toString(),
                auxProgressBar: 1,
                auxProgressBarColor: '#FF0000',
            },
        });
    }
}

async function backupToGithub(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
    event: BackupToGithubAction,
    factory: OctokitFactory,
    store: CausalTreeStore
) {
    console.log('[BackupModule] Backing up all channels to Github');
    const options = calculateOptions(event.options);
    const channels = await store.getTreeIds();

    const time = new Date(Date.now()).toISOString();
    const botId = await channel.helper.createBot(undefined, {
        auxRunningTasks: true,
        auxTaskBackup: true,
        auxTaskBackupType: 'github',
        auxTaskOutput: 'Uploading...',
        auxProgressBar: 0,
        auxProgressBarColor: '#FCE24C',
        auxTaskTime: time,
    });
    const bot = channel.helper.botsState[botId];

    let gistFiles: any = {};
    let index = 0;
    for (let id of channels) {
        const stored = await store.get(
            id,
            options.includeArchived ? undefined : false
        );
        gistFiles[`${id}.aux`] = {
            content: JSON.stringify(stored),
        };

        index += 1;

        let percent = (index / channels.length) * 0.8;
        await channel.helper.updateBot(bot, {
            tags: {
                auxProgressBar: percent,
            },
        });
    }

    try {
        const octokit = factory(event.auth);
        const response = await octokit.gists.create({
            files: gistFiles,
            description: `Backup from ${time}`,
        });

        await channel.helper.updateBot(bot, {
            tags: {
                auxRunningTasks: null,
                auxFinishedTasks: true,
                auxTaskOutput: `Uploaded ${channels.length} channels.`,
                auxTaskBackupUrl: response.data.html_url,
                auxProgressBar: 1,
                auxProgressBarColor: '#00FF00',
            },
        });

        console.log('[BackupModule] Channels backed up!');
    } catch (err) {
        console.error('[BackupModule]', err.toString());
        await channel.helper.updateBot(bot, {
            tags: {
                auxRunningTasks: null,
                auxFinishedTasks: true,
                auxTaskOutput: 'The task failed.',
                auxTaskError: err.toString(),
                auxProgressBar: 1,
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
