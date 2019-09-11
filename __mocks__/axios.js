'use strict';

const axios = jest.genMockFromModule('axios');

let shouldFail = false;
let lastPost;
let lastPut;
let response;
axios.post = (url, data) => {
    if (shouldFail) {
        throw new Error('Post failed.');
    }
    lastPost = [url, data];
    return response;
};
axios.put = (url, data) => {
    if (shouldFail) {
        throw new Error('Put failed.');
    }
    lastPut = [url, data];
    return response;
};

axios.__setResponse = resp => {
    response = resp;
};
axios.__getLastPost = () => lastPost;
axios.__getLastPut = () => lastPut;
axios.__reset = () => {
    lastPost = undefined;
    lastPut = undefined;
    shouldFail = false;
    response = undefined;
};
axios.__setFail = fail => {
    shouldFail = fail;
};

module.exports = axios;
