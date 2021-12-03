import { loadScript } from '../SharedUtils';

let stripeLoaded = false;

export async function loadStripe() {
    if (stripeLoaded) {
        return;
    }

    stripeLoaded = true;
    await loadScript('https://js.stripe.com/v3/');
}
