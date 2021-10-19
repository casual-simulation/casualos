const allowedOrigins = new Set([
    'http://localhost:3002',
    'https://casualos.me',
    'https://ab1.link',
]);

function findHeader(request, header) {
    let headerKey = Object.keys(request.headers).find(
        (key) => key.toLowerCase() === header.toLowerCase()
    );
    if (headerKey) {
        return request.headers[headerKey];
    }
    return undefined;
}

function validateOrigin(request, origins = allowedOrigins) {
    const origin = findHeader(request, 'origin');
    return origins.has(origin);
}

module.exports = {
    allowedOrigins,
    findHeader,
    validateOrigin,
    formatResponse: (request, response, origins = allowedOrigins) => {
        const origin = findHeader(request, 'origin');
        let headers = {};
        if (origins.has(origin)) {
            headers['Access-Control-Allow-Origin'] = origin;
            headers['Access-Control-Allow-Headers'] =
                'Content-Type, Authorization';
        }

        return {
            ...response,
            headers,
        };
    },
};
