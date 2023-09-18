import '@casual-simulation/aux-vm/globalThis-polyfill';
import { AuxVMImpl, BotManager } from '@casual-simulation/aux-vm-browser';
import { Subscription } from 'rxjs';
import { appManager } from '../shared/AppManager';
import { PlaywrightSimulation } from './PlaywrightSimulation';

appManager.simulationFactory = (id, origin, config) => {
    const partitions = PlaywrightSimulation.createPartitions(
        id,
        appManager.indicator
    );
    return new PlaywrightSimulation(
        appManager.indicator,
        {
            recordName: null,
            inst: null,
        },
        id,
        config,
        new AuxVMImpl(appManager.indicator, {
            config,
            partitions,
        })
    ) as unknown as BotManager;
};
import '../aux-player/index';
