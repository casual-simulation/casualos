import { AuxModule, AuxChannel } from '@casual-simulation/aux-vm';
import {
    USERNAME_CLAIM,
    RealtimeChannelInfo,
    DeviceInfo,
    remote,
    SESSION_ID_CLAIM,
    CausalTreeStore,
    DEVICE_ID_CLAIM,
} from '@casual-simulation/causal-trees';
import { Subscription } from 'rxjs';
import { flatMap } from 'rxjs/operators';
import {
    LocalActions,
    CheckoutSubmittedAction,
    ON_CHECKOUT_ACTION_NAME,
    FinishCheckoutAction,
    calculateStringTagValue,
    BotTags,
    action,
    ON_PAYMENT_SUCCESSFUL_ACTION_NAME,
    ON_PAYMENT_FAILED_ACTION_NAME,
    SaveFileAction,
    LoadFileAction,
} from '@casual-simulation/aux-common';
import {
    NodeAuxChannel,
    isAdminChannel,
    AuxChannelManager,
} from '@casual-simulation/aux-vm-node';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const existsAsync = promisify(fs.exists);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);

/**
 * Defines an module that adds Github-related functionality.
 */
export class FilesModule implements AuxModule {
    storageDir: string;

    constructor(storageDir: string) {
        this.storageDir = storageDir;
    }

    async setup(
        info: RealtimeChannelInfo,
        channel: NodeAuxChannel
    ): Promise<Subscription> {
        let sub = new Subscription();

        sub.add(
            channel.onLocalEvents
                .pipe(
                    flatMap(events => events),
                    flatMap(async event => {
                        if (event.type === 'save_file') {
                            await this._saveFile(channel, event);
                        } else if (event.type === 'load_file') {
                            await this._loadFile(channel, event);
                        }
                    })
                )
                .subscribe()
        );

        return sub;
    }

    private async _loadFile(channel: NodeAuxChannel, event: LoadFileAction) {
        const final = path.join(this.storageDir, event.options.path);
        try {
            const exists = await existsAsync(final);

            if (!exists) {
                if (event.options.callbackShout) {
                    await channel.helper.transaction(
                        action(
                            event.options.callbackShout,
                            null,
                            channel.helper.userId,
                            {
                                path: event.options.path,
                                error: 'file_does_not_exist',
                            }
                        )
                    );
                }
            } else {
                console.log(`[FilesModule] Reading file ${final}...`);
                const data = await readFileAsync(final, { encoding: 'utf8' });
                if (event.options.callbackShout) {
                    await channel.helper.transaction(
                        action(
                            event.options.callbackShout,
                            null,
                            channel.helper.userId,
                            {
                                path: event.options.path,
                                data: data,
                            }
                        )
                    );
                }
            }
        } catch (err) {
            if (event.options.callbackShout) {
                await channel.helper.transaction(
                    action(
                        event.options.callbackShout,
                        null,
                        channel.helper.userId,
                        {
                            path: event.options.path,
                            error: 'failure',
                            exception: err,
                        }
                    )
                );
            }
        }
    }

    private async _saveFile(channel: NodeAuxChannel, event: SaveFileAction) {
        const final = path.join(this.storageDir, event.options.path);

        try {
            const dirExists = await existsAsync(this.storageDir);
            if (!dirExists) {
                await mkdirAsync(this.storageDir, { recursive: true });
            }
            const exists = await existsAsync(final);

            if (exists && !event.options.overwriteExistingFile) {
                if (event.options.callbackShout) {
                    await channel.helper.transaction(
                        action(
                            event.options.callbackShout,
                            null,
                            channel.helper.userId,
                            {
                                path: event.options.path,
                                error: 'file_already_exists',
                            }
                        )
                    );
                }
            } else {
                console.log(`[FilesModule] Writing file ${final}...`);
                await writeFileAsync(final, event.options.data);
                if (event.options.callbackShout) {
                    await channel.helper.transaction(
                        action(
                            event.options.callbackShout,
                            null,
                            channel.helper.userId,
                            {
                                path: event.options.path,
                            }
                        )
                    );
                }
            }
        } catch (err) {
            if (event.options.callbackShout) {
                await channel.helper.transaction(
                    action(
                        event.options.callbackShout,
                        null,
                        channel.helper.userId,
                        {
                            path: event.options.path,
                            error: 'failure',
                            exception: err,
                        }
                    )
                );
            }
        }
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
