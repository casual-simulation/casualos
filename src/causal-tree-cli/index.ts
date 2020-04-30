import { prompt } from 'inquirer';
import { migrateMenu } from './migrate';

main().catch(err => {
    console.error(err);
    process.exit(1);
});

async function main() {
    await mainMenu();
}

async function mainMenu() {
    const answer = await prompt({
        type: 'list',
        name: 'action',
        message: 'What do you want to do?',
        choices: ['Migrate'],
    });

    if (answer.action === 'Migrate') {
        await migrateMenu();
    } else {
        console.log('Invalid Choice');
    }
}
