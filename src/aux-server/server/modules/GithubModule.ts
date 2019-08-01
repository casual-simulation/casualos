import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    ADMIN_ROLE,
    DeviceInfo,
    remote,
    SESSION_ID_CLAIM,
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

/**
 * Defines an module that adds Github-related functionality.
 */
export class GithubModule implements AuxModule {
    private _adminChannel: NodeAuxChannel;

    constructor() {}

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
                                        local
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
    event: BackupToGithubEvent
) {
    const allowed = isAdminChannel(info);
    if (!allowed) {
        return;
    }

    await channel.helper.createFile(undefined, {
        'aux.tasks': true,
        'aux.task.github': true,
        'aux.task.output': 'Uploading...',
        'aux.progressBar': 0,
        'aux.progressBar.color': '#00FF00',
    });
}
