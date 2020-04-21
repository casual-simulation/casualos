export function getFinalUrl(defaultHost: string, host?: string) {
    const url = new URL(defaultHost);
    const override = host ? new URL(host) : null;
    const finalUrl = override
        ? `${getFinalProtocol(url.protocol, override.protocol)}//${
              override.host
          }`
        : defaultHost;
    return finalUrl;
}

export function getFinalProtocol(
    defaultProtocol: string,
    overrideProtocol: string
) {
    for (let protocol of [defaultProtocol, overrideProtocol]) {
        if (isSecureProtocol(protocol)) {
            return protocol;
        }
    }

    return overrideProtocol || defaultProtocol;
}

export function isSecureProtocol(protocol: string): boolean {
    return protocol === 'https:';
}
