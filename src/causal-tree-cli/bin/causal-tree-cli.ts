import { prompt } from 'inquirer';

async function main() {
    // Menu structure:
    // - Load branch
    //   - From where? (MongoDB, CassandraDB)
    // - Migrate
    //   - From where?
    //      - To where?

    const answer = await prompt({
        type: 'list',
        name: 'action',
        message: 'What do you want to do?',
        choices: ['Migrate'],
    });

    console.log(answer.action);
}

main();
