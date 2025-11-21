import {
    getTigerBeetleInfo,
    formatTigerBeetle,
} from '../src/aux-records/financial/TigerBeetleTestUtils';

const labels = ['financial', 'records-server', 'subscription-controller'];

const info = await getTigerBeetleInfo();

const promises = labels.map((label) => formatTigerBeetle(info, label));
await Promise.all(promises);
