export function getFinalUrl(defaultHost: string, host?: string) {
    const url = new URL(defaultHost);
    const finalUrl = host ? `${url.protocol}//${host}` : defaultHost;
    return finalUrl;
}
