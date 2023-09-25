import '@casual-simulation/aux-vm/globalThis-polyfill';
import { AuxVMImpl, BotManager } from '@casual-simulation/aux-vm-browser';
import { Subscription } from 'rxjs';
import { appManager } from '../shared/AppManager';
import { PlaywrightSimulation } from './PlaywrightSimulation';

appManager.simulationFactory = async (id, origin, config) => {
    const indicator = await appManager.getConnectionIndicator(
        origin.recordName,
        origin.inst,
        origin.host
    );
    const partitions = PlaywrightSimulation.createPartitions(id, indicator);
    return new PlaywrightSimulation(
        indicator,
        {
            recordName: null,
            inst: null,
        },
        id,
        config,
        new AuxVMImpl(indicator, {
            config,
            partitions,
        })
    ) as unknown as BotManager;
};
import '../aux-player/index';
