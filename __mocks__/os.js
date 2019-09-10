'use strict';

const os = jest.genMockFromModule('os');

let hostname = 'hostname';
let interfaces = {
    lo0: [
        {
            address: '::1',
            family: 'IPv6',
            internal: true,
            mac: 'local:address',
        },
        {
            address: '127.0.0.1',
            family: 'IPv4',
            internal: true,
            mac: 'local:address',
        },
    ],
    eth0: [
        {
            address: '192.168.1.65',
            family: 'IPv4',
            internal: false,
            max: 'ethernet:address',
        },
    ],
    wlan0: [
        {
            address: '192.168.1.128',
            family: 'IPv4',
            internal: false,
            max: 'wlan:address',
        },
    ],
};

os.__setHostname = name => {
    hostname = name;
};
os.hostname = () => hostname;
os.networkInterfaces = () => interfaces;

module.exports = os;
