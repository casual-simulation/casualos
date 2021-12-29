'use strict';

const axios = jest.genMockFromModule('axios');

let shouldFail = false;
let lastPost;
let lastPut;
let lastGet;
let requests = [];
let response;
let responses = [];
let responseIndex = null;
axios.request = (config) => {
    if (shouldFail) {
        throw new Error('Request failed.');
    }
    let { method, url, data, ...rest } = config;
    let lastRequest = [method, url, data, rest];
    requests.push(lastRequest);
    return returnResponse();
};
axios.post = (url, data, config) => {
    if (shouldFail) {
        throw new Error('Post failed.');
    }
    lastPost = [url, data, config].filter((val) => !!val);
    requests.push(['post', ...lastPost]);
    return returnResponse();
};
axios.put = (url, data, config) => {
    if (shouldFail) {
        throw new Error('Put failed.');
    }
    lastPut = [url, data, config].filter((val) => !!val);
    requests.push(['put', ...lastPut]);
    return returnResponse();
};
axios.get = (url, config) => {
    if (shouldFail) {
        throw new Error('Get failed.');
    }
    lastGet = [url];
    if (typeof config !== 'undefined') {
        lastGet.push(config);
    }
    requests.push(['get', ...lastGet]);
    return returnResponse();
};
axios.mockImplementation((options) => {
    return returnResponse();
});

axios.__setResponse = (resp) => {
    response = resp;
};
axios.__setNextResponse = (resp) => {
    responses.push(resp);
    if (responseIndex === null) {
        responseIndex = 0;
    }
    return axios;
};
axios.__getLastPost = () => lastPost;
axios.__getLastPut = () => lastPut;
axios.__getLastGet = () => lastGet || [];
axios.__getRequests = () => requests || [];
axios.__reset = () => {
    lastPost = undefined;
    lastPut = undefined;
    lastGet = undefined;
    shouldFail = false;
    response = undefined;
    responses = [];
    requests = [];
    responseIndex = null;
};
axios.__setFail = (fail) => {
    shouldFail = fail;
};

function returnResponse() {
    if (responseIndex !== null && responseIndex < responses.length) {
        const resp = responses[responseIndex];
        responseIndex += 1;
        return Promise.resolve(resp);
    }
    return Promise.resolve(response);
}

module.exports = axios;
