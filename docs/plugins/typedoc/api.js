const TypeDoc = require('typedoc');
const path = require('path');

let project;
function parseProject() {
    const app = new TypeDoc.Application();
    
    app.options.addReader(new TypeDoc.TSConfigReader());

    app.bootstrap({
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        entryPoints: [path.resolve(__dirname, 'entry.ts')]
    });
    
    const project = app.convert();
    return { app, project };
};

function getProject() {
    if (!project) {
        project = parseProject();
    }
    return project;
}

module.exports = {
    getProject
};