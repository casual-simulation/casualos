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
