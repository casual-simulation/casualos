export interface CacheControlHeaderValues {
    public?: boolean;
    private?: boolean;
    'max-age'?: number;
    's-maxage'?: number;
    'no-cache'?: boolean;
    'no-store'?: boolean;
}

/**
 * Parses the value of a cache control header.
 * @param value The value.
 */
export function parseCacheControlHeader(
    value: string
): CacheControlHeaderValues {
    let values: any = {};

    const directives = value.split(',').map(d => d.trim());
    for (let i = 0; i < directives.length; i++) {
        const split = directives[i].split('=');
        if (split.length === 2) {
            values[split[0]] = parseInt(split[1]);
        } else if (split.length === 1) {
            values[split[0]] = true;
        }
    }

    return values;
}

export function formatCacheControlHeader(header: CacheControlHeaderValues) {
    let entries: string[] = [];
    for (let key in header) {
        if (header.hasOwnProperty(key)) {
            let val = (<any>header)[key];
            if (typeof val === 'boolean') {
                entries.push(key);
            } else {
                entries.push(`${key}=${val}`);
            }
        }
    }

    return entries.join(', ');
}
