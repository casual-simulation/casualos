import { Config } from './config';

const domain = process.env.TARGET_DOMAIN || 'auxplayer.com';
const port = parseInt(process.env.TARGET_PORT || '443');
const secret = process.env.DIRECTORY_TOKEN_SECRET;
const trustProxy = process.env.PROXY_IP_RANGE;
const homeDir = process.env.HOME_DIR || '/home';

const config: Config = {
    httpPort: 3000,
    target: {
        domain,
        port,
    },
    proxy: trustProxy
        ? {
              trust: trustProxy,
          }
        : null,
};

export default config;
