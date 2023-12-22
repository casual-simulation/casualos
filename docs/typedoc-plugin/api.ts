import { Application, ProjectReflection, TSConfigReader } from 'typedoc';
import path from 'path';

let project: ReturnType<typeof parseProject>;
async function parseProject() {
    const tsconfig = path.resolve(__dirname, 'tsconfig.json');
    const app = await Application.bootstrap({
        tsconfig,
        entryPoints: [path.resolve(__dirname, 'entry.ts')],
        inlineTags: [
            `@tag`,
            `@link`
        ]
    }, [new TSConfigReader()]);
    
    // app.options.addReader(new TypeDoc.TSConfigReader());

    // app.bootstrap({
    //     tsconfig: tsconfig,
    //     entryPoints: [path.resolve(__dirname, 'entry.ts')],
    // });
    
    const project = await app.convert();
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