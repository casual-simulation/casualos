import { calculateStringTagValue } from '@casual-simulation/aux-common';
import { Simulation } from '@casual-simulation/aux-vm';

export function getStripeKey(sim: Simulation): string {
    const calc = sim.helper.createContext();
    const config = sim.helper.globalsBot;
    const key = calculateStringTagValue(
        calc,
        config,
        'stripePublishableKey',
        null
    );
    return key;
}

let stripeLoaded = false;

export async function loadStripe() {
    if (stripeLoaded) {
        return;
    }

    stripeLoaded = true;
    await loadScript('https://js.stripe.com/v3/');
}

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;

        el.onload = () => {
            resolve();
        };

        document.body.appendChild(el);
    });
}
