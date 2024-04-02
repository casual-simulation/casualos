import prompts from 'prompts';
import { Command } from 'commander';
import {
    RecordsClient,
    createRecordsClient,
} from '@casual-simulation/aux-records/RecordsClient';
const program = new Command();

let client: ReturnType<typeof createRecordsClient>;
let savedEndpoint: string;

async function getClient(endpoint: string) {
    if (!endpoint) {
        if (!savedEndpoint) {
            const response = await prompts({
                type: 'text',
                name: 'endpoint',
                message: 'Enter the endpoint to use for queries.',
            });

            savedEndpoint = response.endpoint;
        }
        endpoint = savedEndpoint;
    }
    if (!client) {
        client = createRecordsClient(endpoint);
    }
    return client;
}

program
    .name('casualos')
    .description('A CLI for CasualOS')
    .version('0.0.1')
    .option('-e, --endpoint <url>', 'The endpoint to use for queries.');

program
    .command('query')
    .description('Query the CasualOS API')
    .argument('[procedure]', 'The procedure to execute')
    .action(async (procedure, options) => {
        const client = await getClient(options.endpoint);
        if (!procedure) {
            // const availableOperations = await client.
        }
    });

program.parse();

// async function start() {
//     const reponse = await prompts({
//         type: 'select',
//         name: 'action',
//         message: 'What would you like to do?',
//         choices: [
//             { title: 'Migrate', value: 'migrate' },
//             { title: 'Collect Responses', value: 'collect' },
//         ],
//     });

//     if (reponse.action === 'migrate') {
//         await migrate();
//     } else {
//         await collectAndSaveResponses();
//     }
// }
