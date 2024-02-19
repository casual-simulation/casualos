/**
 * Gets the origin for the VM.
 * @param configuredOrigin The origin that was configured.
 * @param defaultOrigin The default that should be used if the configured origin is not set.
 * @param instId The ID of the inst.
 */
export function getVMOrigin(
    configuredOrigin: string | null,
    defaultOrigin: string,
    instId: string
): string {
    if (!configuredOrigin) {
        return defaultOrigin;
    }

    let indexOfBraces = configuredOrigin.indexOf('{{');
    if (indexOfBraces >= 0) {
        let endOfBraces = configuredOrigin.indexOf('}}', indexOfBraces);
        if (
            endOfBraces >= 0 &&
            configuredOrigin.substring(indexOfBraces + 2, endOfBraces) ===
                'inst'
        ) {
            instId = instId.replace(/[^a-zA-Z0-9]/g, '-');
            return (
                configuredOrigin.substring(0, indexOfBraces) +
                instId +
                configuredOrigin.substring(endOfBraces + 2)
            );
        }
    }

    return configuredOrigin;
}

/**
 * Gets the base domain of the given origin. That is, the hostname but with all subdomains removed.
 * @param origin The origin that should be used.
 */
export function getBaseOrigin(origin: string): string {
    try {
        let url = new URL(origin);
        let parts = url.hostname.split('.');
        if (parts.length < 3) {
            return url.origin;
        }
        url.hostname = parts.slice(1).join('.');
        return url.origin;
    } catch (err) {
        console.warn('[AuxVMUtils] Could not parse origin:', origin, err);
        return origin;
    }
}
