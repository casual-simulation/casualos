const allowedOrigins = new Set([
    'http://localhost:3002',
    'https://casualos.me',
]);

module.exports = {
    formatResponse: (request, response) => {
        const origin = request.headers.Origin ?? request.headers.origin;
        console.log('test', JSON.stringify(request.headers));
        console.log('hit');
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
