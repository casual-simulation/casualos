module.exports = {
    formatResponse: (response) => {
        return {
            ...response,
            headers: {
                'Access-Control-Allow-Origin': 'http://localhost:3002',
            },
        };
    },
};
