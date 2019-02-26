import * as path from 'path';
import { ClientConfig } from "./config";

const config: ClientConfig = {
    dist: path.resolve(__dirname, '..', '..', 'aux-web', 'dist'),
    index: 'projector-index.html',
    domains: [
        'filesimulator.com',
        'projector.filesimulator.com',
        'projector.*.filesimulator.com',
        'projector.localhost',
        'localhost'
    ]
};

export default config;