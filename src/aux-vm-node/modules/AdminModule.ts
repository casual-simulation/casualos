import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    ADMIN_ROLE,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap, tap } from 'rxjs/operators';
import {
    GrantRoleEvent,
    calculateFileValue,
    getFileRoles,
    getUserAccountFile,
    AuxFile,
    RevokeRoleEvent,
} from '@casual-simulation/aux-common';
import { NodeAuxChannel } from '../vm/NodeAuxChannel';

/**
 * Defines an AuxModule that adds Admin-related functionality to the module.
 */
export class AdminModule implements AuxModule {
    async setup(
        info: RealtimeChannelInfo,
        channel: AuxChannel
    ): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            channel.onDeviceEvents
                .pipe(
                    flatMap(events => events),
                    flatMap(async event => {
                        if (event.event && event.event.type === 'local') {
                            let local = event.event;
                            if (local.name === 'say_hello') {
                                sayHelloTo(event.device.claims[USERNAME_CLAIM]);
                            } else if (
                                info.id === 'aux-admin' &&
                                event.device.roles.indexOf(ADMIN_ROLE) >= 0
                            ) {
                                if (local.name === 'grant_role') {
                                    await grantRole(
                                        <NodeAuxChannel>channel,
                                        local
                                    );
                                } else if (local.name === 'revoke_role') {
                                    await revokeRole(
                                        <NodeAuxChannel>channel,
                                        local
                                    );
                                }
                            }
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }
}

async function grantRole(channel: NodeAuxChannel, event: GrantRoleEvent) {
    const context = channel.helper.createContext();
    const userFile = <AuxFile>getUserAccountFile(context, event.username);

    if (userFile) {
        const roles = getFileRoles(context, userFile);

        const finalRoles = new Set(roles || []);
        finalRoles.add(event.role);

        await channel.helper.updateFile(userFile, {
            tags: {
                'aux.account.roles': [...finalRoles],
            },
        });
    }
}

async function revokeRole(channel: NodeAuxChannel, event: RevokeRoleEvent) {
    const context = channel.helper.createContext();
    const userFile = <AuxFile>getUserAccountFile(context, event.username);

    if (userFile) {
        const roles = getFileRoles(context, userFile);

        const finalRoles = new Set(roles || []);
        finalRoles.delete(event.role);

        await channel.helper.updateFile(userFile, {
            tags: {
                'aux.account.roles': [...finalRoles],
            },
        });
    }
}

function sayHelloTo(username: string) {
    console.log(`User ${username} says "Hello!"`);
}
