'use strict';

const axios = jest.genMockFromModule('axios');

let lastPost;
let lastPut;
axios.post = (url, data) => {
    lastPost = [url, data];
};
axios.put = (url, data) => {
    lastPut = [url, data];
};

axios.__getLastPost = () => lastPost;
axios.__getLastPut = () => lastPut;
axios.__reset = () => {
    lastPost = undefined;
    lastPut = undefined;
};

module.exports = axios;
