'use strict';

const os = jest.genMockFromModule('os');

let hostname = 'hostname';

let interfaces = {};

os.__setInterfaces = int => {
    interfaces = int;
};
os.__setHostname = name => {
    hostname = name;
};
os.hostname = () => hostname;
os.networkInterfaces = () => {
    return {
        ...interfaces,
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
    };
};

module.exports = os;
