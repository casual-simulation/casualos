import { BotManager } from '@casual-simulation/aux-vm-browser';
import { Subscription } from 'rxjs';
import { appManager } from '../shared/AppManager';
import { PlaywrightSimulation } from './PlaywrightSimulation';

appManager.simulationFactory = (user, id, config) =>
    new PlaywrightSimulation(user, id, config) as unknown as BotManager;

import '../aux-player/index';
