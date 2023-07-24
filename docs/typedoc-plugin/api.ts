import TypeDoc, { ProjectReflection } from 'typedoc';
import path from 'path';

let project: ReturnType<typeof parseProject>;
function parseProject() {
    const tsconfig = path.resolve(__dirname, 'tsconfig.json');
    const app = new TypeDoc.Application();
    
    app.options.addReader(new TypeDoc.TSConfigReader());

    app.bootstrap({
        tsconfig: tsconfig,
        entryPoints: [path.resolve(__dirname, 'entry.ts')],
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

export {
    getProject
};