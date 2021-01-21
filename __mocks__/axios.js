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
axios.post = (url, data) => {
    if (shouldFail) {
        throw new Error('Post failed.');
    }
    lastPost = [url, data];
    requests.push(['post', ...lastPost]);
    return returnResponse();
};
axios.put = (url, data) => {
    if (shouldFail) {
        throw new Error('Put failed.');
    }
    lastPut = [url, data];
    requests.push(['put', ...lastPut]);
    return returnResponse();
};
axios.get = (url) => {
    if (shouldFail) {
        throw new Error('Get failed.');
    }
    lastGet = [url];
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
        return resp;
    }
    return response;
}

module.exports = axios;
