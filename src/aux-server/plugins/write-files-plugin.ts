import { Plugin } from 'vite';

export interface Options {
    files: {
        [fileName: string]: string;
    };
}

export default function writeFilesPlugin(options: Options): Plugin {
    return {
        name: 'write-files',
        async buildEnd(buildOptions) {
            for (let file of Object.keys(options.files)) {
                const moduleName = options.files[file];
                const fileId = await this.resolve(moduleName);
                if (!fileId) {
                    continue;
                }
                const loaded = await this.load(fileId);
                const contents = loaded.code;

                if (contents) {
                    this.emitFile({
                        type: 'asset',
                        fileName: file,
                        source: contents,
                    });
                }
            }
        },
    };
}
