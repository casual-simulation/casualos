/**
 * Gets the push manager for the current browser or null if not supported.
 */
export async function getPushManager(): Promise<PushManager | null> {
    return (await getServiceWorkerRegistration())?.pushManager ?? null;
}

/**
 * Gets the service worker registration for the current browser or null if not supported.
 * @param timeoutMs The number of milliseconds to wait before timing out.
 */
export async function getServiceWorkerRegistration(
    timeoutMs: number = 15000
): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        return null;
    }
    const registration = (await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(null);
            }, 15000);
        }),
    ])) as ServiceWorkerRegistration;

    return registration ?? null;
}
