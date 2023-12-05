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
                const contents = options.files[file];

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
