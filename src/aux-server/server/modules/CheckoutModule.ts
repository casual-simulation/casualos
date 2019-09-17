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
    LocalEvents,
    CheckoutSubmittedEvent,
    ON_CHECKOUT_ACTION_NAME,
} from '@casual-simulation/aux-common';
import {
    NodeAuxChannel,
    isAdminChannel,
    AuxChannelManager,
} from '@casual-simulation/aux-vm-node';

/**
 * Defines an module that adds Github-related functionality.
 */
export class CheckoutModule implements AuxModule {
    private _adminChannel: NodeAuxChannel;
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
                            if (local.name === 'checkout_submitted') {
                                await this._submitCheckout(
                                    info,
                                    local,
                                    event.device
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

    private async _submitCheckout(
        info: RealtimeChannelInfo,
        event: CheckoutSubmittedEvent,
        device: DeviceInfo
    ) {
        const processingInfo: RealtimeChannelInfo = {
            id: `aux-${event.processingChannel}`,
            type: 'aux',
        };
        const hasChannel = await this._channelManager.hasChannel(
            processingInfo
        );
        if (!hasChannel) {
            console.log(
                `[CheckoutModule] Skipping checkout process because the channel does not exist.`
            );
            return;
        }
        const channel = await this._channelManager.loadChannel(processingInfo);

        await channel.simulation.helper.action(ON_CHECKOUT_ACTION_NAME, null, {
            productId: event.productId,
            token: event.token,
        });
    }
}
