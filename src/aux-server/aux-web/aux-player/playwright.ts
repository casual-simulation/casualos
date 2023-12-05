import '@casual-simulation/aux-vm/globalThis-polyfill';
import { AuxVMImpl, BotManager } from '@casual-simulation/aux-vm-browser';
import { Subscription } from 'rxjs';
import { appManager } from '../shared/AppManager';
import { PlaywrightSimulation } from './PlaywrightSimulation';
import { v4 as uuid } from 'uuid';

appManager.simulationFactory = async (id, origin, config) => {
    const configBotId = uuid();
    const indicator = await appManager.getConnectionIndicator(
        configBotId,
        origin.recordName,
        origin.inst,
        origin.host
    );
    const partitions = PlaywrightSimulation.createPartitions(id, indicator);
    return new PlaywrightSimulation(
        {
            recordName: null,
            inst: null,
        },
        config,
        new AuxVMImpl(id, {
            configBotId,
            config,
            partitions,
        })
    ) as unknown as BotManager;
};
import '../aux-player/index';
