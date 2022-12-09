import '@casual-simulation/aux-vm/globalThis-polyfill';
import { AuxVMImpl, BotManager } from '@casual-simulation/aux-vm-browser';
import { Subscription } from 'rxjs';
import { appManager } from '../shared/AppManager';
import { PlaywrightSimulation } from './PlaywrightSimulation';

appManager.simulationFactory = (user, id, config) => {
    const partitions = PlaywrightSimulation.createPartitions(id, user);
    return new PlaywrightSimulation(
        user,
        id,
        config,
        new AuxVMImpl(user, {
            config,
            partitions,
        })
    ) as unknown as BotManager;
};
import '../aux-player/index';
