import { WebConfig } from '../shared/WebConfig';
import process from 'process';

const env = process.env.NODE_ENV;
let webConfig = {
    playerBaseUrl: 'http://localhost:3000',
    projectorBaseUrl: 'http://localhost:3000',
};
if (env === 'production') {
    webConfig = {
        playerBaseUrl: 'https://auxplayer.com',
        projectorBaseUrl: 'https://auxplayer.com',
    };
}

export default webConfig;
