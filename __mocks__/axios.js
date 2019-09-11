'use strict';

const axios = jest.genMockFromModule('axios');

let shouldFail = false;
let lastPost;
let lastPut;
axios.post = (url, data) => {
    if (shouldFail) {
        throw new Error('Post failed.');
    }
    lastPost = [url, data];
};
axios.put = (url, data) => {
    if (shouldFail) {
        throw new Error('Put failed.');
    }
    lastPut = [url, data];
};

axios.__getLastPost = () => lastPost;
axios.__getLastPut = () => lastPut;
axios.__reset = () => {
    lastPost = undefined;
    lastPut = undefined;
    shouldFail = false;
};
axios.__setFail = fail => {
    shouldFail = fail;
};

module.exports = axios;
