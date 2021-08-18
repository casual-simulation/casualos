const allowedOrigins = new Set([
    'http://localhost:3002',
    'https://casualos.me',
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

function validateOrigin(request) {
    const origin = findHeader(request, 'origin');
    return allowedOrigins.has(origin);
}

module.exports = {
    allowedOrigins,
    findHeader,
    validateOrigin,
    formatResponse: (request, response) => {
        const origin = findHeader(request, 'origin');
        let headers = {};
        if (allowedOrigins.has(origin)) {
            headers['Access-Control-Allow-Origin'] = origin;
        }

        return {
            ...response,
            headers,
        };
    },
};
