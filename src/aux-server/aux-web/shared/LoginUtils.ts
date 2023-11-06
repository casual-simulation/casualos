import { appManager } from './AppManager';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { v4 as uuid } from 'uuid';

export function generateGuestId(): string {
    return `guest_${uuid()}`;
}
