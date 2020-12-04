import { prompt } from 'inquirer';

import {
    SocketManager,
    ApiaryConnectionClient,
    AwsSocket,
} from '@casual-simulation/causal-tree-client-apiary';
import { filter, first, skip } from 'rxjs/operators';
import { indexOf } from 'benchmark';
import { option } from 'commander';

export async function debugMenu() {
    const debugAnswer = await prompt({
        type: 'list',
        name: 'source',
        message: 'What do you want to debug?',
        choices: ['Apiary Protocol'],
    });

    if (debugAnswer.source === 'Apiary Protocol') {
        await apiaryProtocolMenu();
    } else {
        console.log('Invalid selection.');
    }
}

export async function apiaryProtocolMenu() {
    const urlAnswser = await prompt({
        type: 'input',
        name: 'url',
        message: 'Where do you want to connect?',
    });

    const manager = new SocketManager(urlAnswser.url);
    manager.init();

    const awsSocket = new AwsSocket(manager.socket);
    const client = new ApiaryConnectionClient(awsSocket, {
        id: 'my-id',
        username: 'my-username',
        token: 'my-token',
    });

    while (true) {
        let options = [];
        if (client.isConnected) {
            options.push('Close Connection');
        } else {
            options.push('Open Connection');
        }
        options.push('Send Message', 'Exit');

        const optionAnswer = await prompt({
            type: 'list',
            name: 'message',
            message: 'What do you want to do?',
            choices: options,
        });

        if (optionAnswer.message === 'Exit') {
            console.log('Done.');
            break;
        } else if (optionAnswer.message === 'Open Connection') {
            const promise = client.connectionState
                .pipe(skip(1), first())
                .toPromise();
            client.connect();
            await promise;
        } else if (optionAnswer.message === 'Close Connection') {
            const promise = client.connectionState
                .pipe(skip(1), first())
                .toPromise();
            client.disconnect();
            await promise;
        } else if (optionAnswer.message === 'Send Message') {
            const messageAnswer = await prompt({
                type: 'input',
                name: 'message',
                message: 'What message do you want to send?',
            });

            client.send('message', messageAnswer.message);
        }
    }
}
