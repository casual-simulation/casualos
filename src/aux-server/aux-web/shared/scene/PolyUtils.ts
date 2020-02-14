import { Simulation } from '@casual-simulation/aux-vm';
import { calculateStringTagValue } from '@casual-simulation/aux-common';

export function getPolyKey(sim: Simulation): string {
    const calc = sim.helper.createContext();
    const config = sim.helper.globalsBot;
    const key = calculateStringTagValue(calc, config, 'polyApiKey', null);
    return key;
}
