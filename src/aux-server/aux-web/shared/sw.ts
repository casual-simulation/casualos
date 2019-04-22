self.addEventListener('fetch', (event: FetchEvent) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);
    if (location.host === url.host) {
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
