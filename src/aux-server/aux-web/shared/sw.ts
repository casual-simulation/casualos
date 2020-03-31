self.addEventListener('fetch', (event: FetchEvent) => {
    if (event.request.method !== 'GET') {
        return;
    }
    const url = new URL(event.request.url);
    if (location.host === url.host) {
        return;
    }

    let hasHeader = false;
    // Check the headers to see if a specific header has been specified.
    // The following headers are ignored because they're common.
    // If they're all allowed, then we can proxy the request.
    for (let [header, value] of <Iterable<[string, string]>>(
        (<unknown>event.request.headers)
    )) {
        if (!header) {
            continue;
        }
        switch (header.toLowerCase()) {
            case 'accept':
            case 'accept-language':
            case 'content-language':
            case 'content-type':
            case 'dnt':
            case 'user-agent':
                continue;
            default:
                hasHeader = true;
                break;
        }
        if (hasHeader) {
            break;
        }
    }
    if (hasHeader) {
        return;
    }

    event.respondWith(fetchByProxy(event.request));
});

async function fetchByProxy(request: Request): Promise<Response> {
    const url = `/proxy?url=${encodeURIComponent(request.url)}`;
    const req = new Request(url);
    const resp = await fetch(req);
    return resp;
}
