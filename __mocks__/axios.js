'use strict';

const axios = jest.genMockFromModule('axios');

let lastPost;
axios.post = (url, data) => {
    lastPost = [url, data];
};

axios.__getLastPost = () => lastPost;
axios.__reset = () => {
    lastPost = undefined;
};

module.exports = axios;
