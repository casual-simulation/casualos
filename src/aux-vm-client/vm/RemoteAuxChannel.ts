import type {
    LocalActions,
    PartitionConfig,
    AuxPartition,
    AuxPartitionServices,
} from '@casual-simulation/aux-common';
import {
    createAuxPartition,
    createMemoryPartition,
    iteratePartitions,
    createOtherPlayersClientPartition,
    createYjsPartition,
    createRemoteClientYjsPartition,
    ConnectionIndicator,
} from '@casual-simulation/aux-common';
import type { AuxConfig, AuxChannelOptions } from '@casual-simulation/aux-vm';
import { BaseAuxChannel } from '@casual-simulation/aux-vm';
import {
    createOtherPlayersRepoPartition,
    createRemoteYjsPartition,
    createRemoteYjsSharedDocument,
    createTimeSyncController,
} from '../partitions';
import type { TimeSyncController } from '@casual-simulation/timesync';
import type { AuxRuntime } from '@casual-simulation/aux-runtime';
import type { RemoteSharedDocumentConfig } from '@casual-simulation/aux-common/documents/SharedDocumentConfig';
import type { SharedDocumentServices } from '@casual-simulation/aux-common/documents/SharedDocumentFactories';
import { createSharedDocument } from '@casual-simulation/aux-common/documents/SharedDocumentFactories';
import type { SharedDocument } from '@casual-simulation/aux-common/documents/SharedDocument';
import { createYjsSharedDocument } from '@casual-simulation/aux-common/documents/YjsSharedDocument';

export interface RemoteAuxChannelOptions extends AuxChannelOptions {}

export class RemoteAuxChannel extends BaseAuxChannel {
    constructor(config: AuxConfig, options: RemoteAuxChannelOptions) {
        super(config, options);
    }

    protected async _createPartition(
        config: PartitionConfig,
        services: AuxPartitionServices
    ): Promise<AuxPartition> {
        return await createAuxPartition(
            config,
            services,
            createMemoryPartition,
            (config) =>
                createOtherPlayersClientPartition(config, services.authSource),
            (config) =>
                createOtherPlayersRepoPartition(config, services.authSource),
            (config) => createYjsPartition(config),
            (config) => createRemoteYjsPartition(config, services.authSource),
            (config) =>
                createRemoteClientYjsPartition(config, services.authSource)
        );
    }

    protected async _createSharedDocument(
        config: RemoteSharedDocumentConfig,
        services: SharedDocumentServices
    ): Promise<SharedDocument> {
        return await createSharedDocument(
            config,
            services,
            (config, services) =>
                createRemoteYjsSharedDocument(config, services.authSource),
            createYjsSharedDocument
        );
    }

    protected _createTimeSyncController(): TimeSyncController {
        if (this._config?.config?.timesync) {
            return (
                createTimeSyncController(
                    this._config.config.timesync,
                    this._authSource
                ) ?? super._createTimeSyncController()
            );
        }
        return super._createTimeSyncController();
    }

    protected _handleError(error: any) {
        if (error instanceof Error) {
            super._handleError({
                type: 'general',
                message: error.toString(),
            });
        } else {
            super._handleError(error);
        }
    }

    protected _handleLocalEvents(e: LocalActions[]) {
        for (let event of e) {
            if (event.type === 'set_offline_state') {
                for (let [key, partition] of iteratePartitions(
                    this._partitions
                )) {
                    if ('forcedOffline' in partition) {
                        partition.forcedOffline = event.offline;
                    }
                }
            }
        }
        super._handleLocalEvents(e);
    }

    protected _createSubChannel(
        runtime: AuxRuntime,
        config: AuxConfig
    ): BaseAuxChannel {
        const channel = new RemoteAuxChannel(config, this._options);
        channel._runtime = runtime;
        return channel;
    }
}
