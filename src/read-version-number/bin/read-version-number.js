const program = require('commander');
const {
    findFirstVersionNumber,
    formatVersionNumber,
} = require('../src/find-first-version-number');

program
    .command('read')
    .requiredOption('-t, --text <text>', 'The release text')
    .action(cmd => {
        const { text } = cmd;
        const version = findFirstVersionNumber(text);
        if (!version) {
            throw new Error('Could not find version');
        }
        const formatted = formatVersionNumber(version);
        console.log(formatted);
    });

program.parse(process.argv);
