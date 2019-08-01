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
    GrantRoleEvent,
    calculateFileValue,
    getFileRoles,
    getUserAccountFile,
    getTokensForUserAccount,
    findMatchingToken,
    AuxFile,
    RevokeRoleEvent,
    ShellEvent,
    getChannelFileById,
    LocalEvents,
    EchoEvent,
    action,
    BackupToGithubEvent,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel, isAdminChannel } from '@casual-simulation/aux-vm-node';
import Octokit from '@octokit/rest';
import {
    getFileChannel,
    filesInContext,
} from '@casual-simulation/aux-common/Files';

export type OctokitFactory = (auth: string) => Octokit;

/**
 * Defines an module that adds Github-related functionality.
 */
export class GithubModule implements AuxModule {
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
                        if (event.event && event.event.type === 'local') {
                            let local = <LocalEvents>event.event;
                            if (event.device.roles.indexOf(ADMIN_ROLE) >= 0) {
                                if (local.name === 'backup_to_github') {
                                    await backupToGithub(
                                        info,
                                        this._adminChannel,
                                        event.device,
                                        local,
                                        this._octokitFactory,
                                        this._store
                                    );
                                }
                            } else {
                                console.log(
                                    `[AdminModule] Cannot run event ${
                                        local.name
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
    ): Promise<Subscription> {
        return new Subscription();
    }
}

async function backupToGithub(
    info: RealtimeChannelInfo,
    channel: NodeAuxChannel,
    device: DeviceInfo,
    event: BackupToGithubEvent,
    factory: OctokitFactory,
    store: CausalTreeStore
) {
    const allowed = isAdminChannel(info);
    if (!allowed) {
        return;
    }

    console.log('[GithubModule] Backing up all channels to Github');
    const calc = channel.helper.createContext();
    const files = filesInContext(calc, 'aux.channels');
    const channels = files
        .map(f => getFileChannel(calc, f))
        .filter(channel => channel);
    const channelsSet = new Set([...channels, 'admin']);

    const time = new Date(Date.now()).toISOString();
    const fileId = await channel.helper.createFile(undefined, {
        'aux.tasks': true,
        'aux.task.github': true,
        'aux.task.output': 'Uploading...',
        'aux.progressBar': 0,
        'aux.progressBar.color': '#FCE24C',
        'aux.task.time': time,
    });
    const file = channel.helper.filesState[fileId];

    let gistFiles: any = {};
    let index = 0;
    for (let c of channelsSet) {
        const id = `aux-${c}`;
        const stored = await store.get(id);
        gistFiles[`${id}.aux`] = {
            content: JSON.stringify(stored),
        };

        index += 1;

        let percent = (index / channelsSet.size) * 0.8;
        await channel.helper.updateFile(file, {
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

        await channel.helper.updateFile(file, {
            tags: {
                'aux.tasks': null,
                'aux.finishedTasks': true,
                'aux.task.output': `Uploaded ${channelsSet.size} channels.`,
                'aux.task.github.url': response.data.html_url,
                'aux.progressBar': 1,
                'aux.progressBar.color': '#00FF00',
            },
        });

        console.log('[GithubModule] Channels backed up!');
    } catch (err) {
        console.error('[GithubModule]', err.toString());
        await channel.helper.updateFile(file, {
            tags: {
                'aux.tasks': null,
                'aux.finishedTasks': true,
                'aux.task.output': 'The task failed.',
                'aux.task.error': err.toString(),
                'aux.progressBar': 1,
                'aux.progressBar.color': '#FF0000',
            },
        });
    }
}
