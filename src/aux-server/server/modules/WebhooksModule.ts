import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    ADMIN_ROLE,
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
} from '@casual-simulation/aux-common';
import {
    NodeAuxChannel,
    AuxChannelManager,
} from '@casual-simulation/aux-vm-node';
import { sendWebhook } from '../../shared/WebhookUtils';

/**
 * Defines an AuxModule that adds Admin-related functionality to the module.
 */
export class WebhooksModule implements AuxModule {
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
                        if (event.type === 'send_webhook') {
                            await this._sendWebhook(info, event);
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

    private async _sendWebhook(
        info: RealtimeChannelInfo,
        event: SendWebhookAction
    ) {
        console.log(`[WebhooksModule] Sending Webhook to ${event.options.url}`);
        const channel = await this._channelManager.loadChannel(info);
        await sendWebhook(channel.simulation, event);
    }
}
