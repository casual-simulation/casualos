import { WebConfig } from '../shared/WebConfig';
import process from 'process';

const env = process.env.NODE_ENV;
let webConfig: WebConfig;
if (env === 'production') {
    webConfig = {
        playerBaseUrl: 'https://auxplayer.com',
        projectorBaseUrl: 'https://auxbuilder.com'
    }
} else {
    webConfig = {
        playerBaseUrl: 'http://player.localhost:3000',
        projectorBaseUrl: 'http://localhost:3000'
    }
}

export default webConfig;