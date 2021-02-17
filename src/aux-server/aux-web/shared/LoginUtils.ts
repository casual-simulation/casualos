import { appManager } from './AppManager';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { v4 as uuid } from 'uuid';

export async function loginToSim(sim: BrowserSimulation, username: string) {
    const user = await appManager.getUser(username);
    await appManager.setCurrentUser(user);

    await sim.login.setUser(user);
}

export function generateGuestId(): string {
    return `guest_${uuid()}`;
}
