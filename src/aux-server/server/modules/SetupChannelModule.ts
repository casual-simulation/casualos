import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    DeviceInfo,
    remote,
    SESSION_ID_CLAIM,
    GUEST_ROLE,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap, tap } from 'rxjs/operators';
import {
    calculateBotValue,
    getBotRoles,
    getUserAccountBot,
    getTokensForUserAccount,
    findMatchingToken,
    AuxBot,
    ShellAction,
    getChannelBotById,
    LocalActions,
    EchoAction,
    action,
    SendWebhookAction,
    BotAction,
    SetupChannelAction,
    isBot,
    createBot,
    CREATE_ACTION_NAME,
} from '@casual-simulation/aux-common';
import {
    NodeAuxChannel,
    AuxChannelManager,
} from '@casual-simulation/aux-vm-node';
import { sendWebhook } from '../../shared/WebhookUtils';

/**
 * Defines an AuxModule that adds setup channel functionality.
 */
export class SetupChannelModule implements AuxModule {
    private _channelManager: AuxChannelManager;

    constructor() {}

    setChannelManager(manager: AuxChannelManager) {
        this._channelManager = manager;
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
                    flatMap(async event => {
                        if (event.type === 'setup_channel') {
                            await this._setupChannel(info, event);
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }

    async deviceConnected(
        info: RealtimeChannelInfo,
        channel: NodeAuxChannel,
        device: DeviceInfo
    ): Promise<void> {}

    async deviceDisconnected(
        info: RealtimeChannelInfo,
        channel: NodeAuxChannel,
        device: DeviceInfo
    ): Promise<void> {}

    private async _setupChannel(
        info: RealtimeChannelInfo,
        event: SetupChannelAction
    ) {
        const newChannelInfo = {
            id: event.channel,
            type: 'aux',
        };
        const hasChannel = await this._channelManager.hasChannel(
            newChannelInfo
        );
        if (!hasChannel) {
            console.log(
                `[SetupChannelModule] Setting up new channel ${event.channel}`
            );
            const channel = await this._channelManager.loadChannel(
                newChannelInfo
            );

            if (event.botOrMod) {
                const botId = await channel.simulation.helper.createBot(
                    undefined,
                    isBot(event.botOrMod) ? event.botOrMod.tags : event.botOrMod
                );
                const newBot = channel.simulation.helper.botsState[botId];
                await channel.simulation.helper.action(CREATE_ACTION_NAME, [
                    newBot,
                ]);
            }
        }
    }
}
