import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    ADMIN_ROLE,
    DeviceInfo,
    remote,
    SESSION_ID_CLAIM,
    CausalTreeStore,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    GrantRoleAction,
    calculateBotValue,
    getBotRoles,
    getUserAccountFile,
    getTokensForUserAccount,
    findMatchingToken,
    AuxFile,
    RevokeRoleAction,
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
    botsInContext,
    BackupAsDownloadAction,
    download,
    BackupOptions,
} from '@casual-simulation/aux-common/Files';
import { getChannelIds } from './BackupHelpers';
import JSZip from 'jszip';

export type OctokitFactory = (auth: string) => Octokit;

/**
 * Defines an module that adds Github-related functionality.
 */
export class BackupModule implements AuxModule {
    private _adminChannel: NodeAuxChannel;
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

        if (isAdminChannel(info)) {
            this._adminChannel = <NodeAuxChannel>channel;
        }

        sub.add(
            channel.onDeviceEvents
                .pipe(
                    flatMap(events => events),
                    flatMap(async event => {
                        if (event.event) {
                            let local = <LocalActions>event.event;
                            if (event.device.roles.indexOf(ADMIN_ROLE) >= 0) {
                                if (local.type === 'backup_to_github') {
                                    await backupToGithub(
                                        info,
                                        this._adminChannel,
                                        event.device,
                                        local,
                                        this._octokitFactory,
                                        this._store
                                    );
                                } else if (
                                    local.type === 'backup_as_download'
                                ) {
                                    await backupAsDownload(
                                        info,
                                        this._adminChannel,
                                        event.device,
                                        local,
                                        this._store
                                    );
                                }
                            } else {
                                console.log(
                                    `[BackupModule] Cannot run event ${
                                        local.type
                                    } because the user is not an admin.`
                                );
                            }
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
    device: DeviceInfo,
    event: BackupAsDownloadAction,
    store: CausalTreeStore
) {
    const allowed = isAdminChannel(info);
    if (!allowed) {
        return;
    }

    console.log('[BackupModule] Backing up all channels as a download');
    const options = calculateOptions(event.options);
    const calc = channel.helper.createContext();
    const channels = getChannelIds(calc);

    const time = new Date(Date.now()).toISOString();
    const botId = await channel.helper.createBot(undefined, {
        'aux.runningTasks': true,
        'aux.task.backup': true,
        'aux.task.backup.type': 'download',
        'aux.task.output': 'Preparing...',
        'aux.progressBar': 0,
        'aux.progressBar.color': '#FCE24C',
        'aux.task.time': time,
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
                    'aux.progressBar': percent,
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
                'aux.runningTasks': null,
                'aux.finishedTasks': true,
                'aux.task.output': `Downloaded ${channels.length} channels.`,
                'aux.progressBar': 1,
                'aux.progressBar.color': '#00FF00',
            },
        });

        await channel.sendEvents([
            remote(download(buffer, 'backup.zip', 'application/zip'), {
                sessionId: device.claims[SESSION_ID_CLAIM],
            }),
        ]);
    } catch (err) {
        console.error('[BackupModule]', err.toString());
        await channel.helper.updateBot(bot, {
            tags: {
                'aux.runningTasks': null,
                'aux.finishedTasks': true,
                'aux.task.output': 'The task failed.',
                'aux.task.error': err.toString(),
                'aux.progressBar': 1,
                'aux.progressBar.color': '#FF0000',
            },
        });
    }
}

async function backupToGithub(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
    device: DeviceInfo,
    event: BackupToGithubAction,
    factory: OctokitFactory,
    store: CausalTreeStore
) {
    const allowed = isAdminChannel(info);
    if (!allowed) {
        return;
    }

    console.log('[BackupModule] Backing up all channels to Github');
    const options = calculateOptions(event.options);
    const calc = channel.helper.createContext();
    const channels = getChannelIds(calc);

    const time = new Date(Date.now()).toISOString();
    const botId = await channel.helper.createBot(undefined, {
        'aux.runningTasks': true,
        'aux.task.backup': true,
        'aux.task.backup.type': 'github',
        'aux.task.output': 'Uploading...',
        'aux.progressBar': 0,
        'aux.progressBar.color': '#FCE24C',
        'aux.task.time': time,
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
                'aux.progressBar': percent,
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
                'aux.runningTasks': null,
                'aux.finishedTasks': true,
                'aux.task.output': `Uploaded ${channels.length} channels.`,
                'aux.task.backup.url': response.data.html_url,
                'aux.progressBar': 1,
                'aux.progressBar.color': '#00FF00',
            },
        });

        console.log('[BackupModule] Channels backed up!');
    } catch (err) {
        console.error('[BackupModule]', err.toString());
        await channel.helper.updateBot(bot, {
            tags: {
                'aux.runningTasks': null,
                'aux.finishedTasks': true,
                'aux.task.output': 'The task failed.',
                'aux.task.error': err.toString(),
                'aux.progressBar': 1,
                'aux.progressBar.color': '#FF0000',
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
