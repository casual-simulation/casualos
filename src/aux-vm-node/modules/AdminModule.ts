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
    const userFiles = channel.helper.objects.filter(
        o => calculateFileValue(context, o, 'aux.username') === event.username
    );

    if (userFiles.length > 0) {
        const userFile = userFiles[0];
        const roles = <string[]>(
            calculateFileValue(context, userFile, 'aux.roles')
        );

        const finalRoles = new Set(roles || []);
        finalRoles.add(event.role);

        await channel.helper.updateFile(userFile, {
            tags: {
                'aux.roles': [...finalRoles],
            },
        });
    }
}

function sayHelloTo(username: string) {
    console.log(`User ${username} says "Hello!"`);
}
