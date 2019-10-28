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
import fs, { readdir } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { DRIVES_URL } from '../config';

const existsAsync = promisify(fs.exists);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);
const readdirAsync = promisify(fs.readdir);
const lstatAsync = promisify(fs.lstat);

/**
 * Defines an module that adds the ability to load and save files.
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
        try {
            const filenamePath = getFilenamePath(event.options.path);

            const fullPath = path.join(this.storageDir, filenamePath);
            const loaded = await this._tryLoadFile(fullPath, channel, event);

            if (loaded) {
                return;
            }

            const directories = await this._listDirectories();
            for (let dir of directories) {
                const final = path.join(dir, filenamePath);

                const loaded = await this._tryLoadFile(final, channel, event);
                if (loaded) {
                    return;
                }
            }

            await this._sendCallback(event, channel, {
                path: event.options.path,
                error: 'file_does_not_exist',
            });
        } catch (err) {
            await this._sendCallback(event, channel, {
                path: event.options.path,
                error: 'failure',
                exception: err,
            });
        }
    }

    private async _tryLoadFile(
        path: string,
        channel: NodeAuxChannel,
        event: LoadFileAction
    ) {
        const exists = await existsAsync(path);

        if (!exists) {
            return false;
        }

        console.log(`[FilesModule] Reading file ${path}...`);
        const data = await readFileAsync(path, { encoding: 'utf8' });
        await this._sendCallback(event, channel, {
            path: event.options.path,
            url: getRemotePath(path),
            data: data,
        });
        return true;
    }

    private async _saveFile(channel: NodeAuxChannel, event: SaveFileAction) {
        try {
            const filePath = getFilenamePath(event.options.path);
            const parts = filePath.split('/').filter(s => s !== '');
            if (parts.length > 1) {
                const originalDirectory = path.join(this.storageDir, parts[0]);
                const originalDirectoryExists = await existsAsync(
                    originalDirectory
                );

                if (originalDirectoryExists) {
                    const final = path.join(
                        originalDirectory,
                        ...parts.slice(1)
                    );
                    await this._trySaveFile(final, event, channel, filePath);
                    return;
                }
            }

            const directories = await this._listDirectories();

            if (directories.length <= 0) {
                await this._sendCallback(event, channel, {
                    path: filePath,
                    error: 'nowhere_to_store_file',
                });
                return;
            }

            const final = path.join(directories[0], filePath);
            await this._trySaveFile(final, event, channel, filePath);
        } catch (err) {
            await this._sendCallback(event, channel, {
                path: event.options.path,
                error: 'failure',
                exception: err,
            });
        }
    }

    private async _trySaveFile(
        finalPath: string,
        event: SaveFileAction,
        channel: NodeAuxChannel,
        filePath: string
    ) {
        const finalDirectory = path.dirname(finalPath);

        const dirExists = await existsAsync(finalDirectory);
        if (!dirExists) {
            await mkdirAsync(finalDirectory, { recursive: true });
        }
        const exists = await existsAsync(finalPath);
        if (exists && !event.options.overwriteExistingFile) {
            await this._sendCallback(event, channel, {
                path: event.options.path,
                error: 'file_already_exists',
            });
        } else {
            console.log(`[FilesModule] Writing file ${finalPath}...`);
            await writeFileAsync(finalPath, event.options.data);
            await this._sendCallback(event, channel, {
                path: event.options.path,
                url: getRemotePath(filePath),
            });
        }
    }

    private async _sendCallback(
        event: SaveFileAction | LoadFileAction,
        channel: NodeAuxChannel,
        arg: any
    ) {
        if (event.options.callbackShout) {
            await channel.helper.transaction(
                action(
                    event.options.callbackShout,
                    null,
                    channel.helper.userId,
                    arg
                )
            );
        }
    }

    private async _listDirectories() {
        const list = await readdirAsync(this.storageDir);

        let results: string[] = [];
        for (let l of list) {
            const full = path.join(this.storageDir, l);
            const stat = await lstatAsync(full);
            if (stat.isDirectory()) {
                results.push(full);
            }
        }
        return results;
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

/**
 * Strips the "/drives" portion from the start of the path.
 * @param path The path.
 */
function getFilenamePath(path: string) {
    return path.startsWith(DRIVES_URL) ? path.substr(DRIVES_URL.length) : path;
}

/**
 * Adds the "/drives" portion to the start of the path.
 * @param path The path.
 */
function getRemotePath(path: string) {
    return `${DRIVES_URL}/${path}`;
}
