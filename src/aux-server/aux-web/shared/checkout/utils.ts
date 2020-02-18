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
