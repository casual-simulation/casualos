import {
    BotIndexEvent,
    PrecalculatedBotsState,
    StateUpdatedEvent,
    applyUpdates,
    calculateStringTagValue,
} from '@casual-simulation/aux-common';
import {
    initialize,
    ts,
    TypeScriptWorker,
    libFileMap,
} from '@casual-simulation/monaco-editor/esm/vs/language/typescript/ts.worker';
import type { worker, languages, Uri } from '@casual-simulation/monaco-editor';
import { file } from 'mock-fs/lib/filesystem';
import { getIdFromModelUri, getModelUriFromId } from '../MonacoUtils';

/**
 * Loading a default lib as a source file will mess up TS completely.
 * So our strategy is to hide such a text model from TS.
 * See https://github.com/microsoft/monaco-editor/issues/2182
 */
function fileNameIsLib(resource: string): string {
    if (typeof resource === 'string') {
        if (/^file:\/\/\//.test(resource)) {
            const path = resource.substr(8);
            if (!!libFileMap[path]) {
                return `file://${path}`;
            }
        } else if (!!libFileMap[resource]) {
            return resource;
        }
    }
    return null;
}

export class CustomTypeScriptWorker extends TypeScriptWorker {
    private _botStates: {
        [id: string]: PrecalculatedBotsState;
    };

    constructor(ctx: worker.IWorkerContext, createData: any) {
        super(ctx, createData);
        this._botStates = {};
    }

    resolveModuleNames(
        moduleNames: string[],
        containingFile: string,
        reusedNames: string[] | undefined,
        redirectedReference: ts.ResolvedProjectReference | undefined,
        options: ts.CompilerOptions,
        containingSourceFile?: ts.SourceFile
    ): (ts.ResolvedModule | undefined)[] {
        console.log(
            'Resolve Module Names',
            moduleNames,
            containingFile,
            reusedNames,
            redirectedReference,
            options,
            containingSourceFile
        );
        let resolutions: (ts.ResolvedModule | undefined)[] = [];
        for (let moduleName of moduleNames) {
            if (
                moduleName === './AuxDefinitions' ||
                moduleName === 'casualos'
            ) {
                resolutions.push({
                    resolvedFileName: 'file:///AuxDefinitions.d.ts',
                });
            } else {
                const botInfo = getIdFromModelUri(containingFile);

                if (botInfo) {
                    const botsState = this._findBotsFromSim(botInfo.id);

                    if (!botsState) {
                        console.log('Could not find bot state for', botInfo.id);
                        resolutions.push(undefined);
                        continue;
                    }

                    console.log('Resolve for bot', botInfo);
                    const isRelativeImport =
                        moduleName.startsWith('.') ||
                        moduleName.startsWith(':');
                    if (isRelativeImport) {
                        console.log('relative import');
                        const bot = botsState[botInfo.id];
                        if (!bot) {
                            console.log('could not find bot');
                            resolutions.push(undefined);
                            continue;
                        }

                        const system = calculateStringTagValue(
                            null,
                            bot,
                            'system',
                            `🔗${bot.id}`
                        );
                        const split = system.split('.');

                        for (let i = 0; i < moduleName.length; i++) {
                            if (moduleName[i] === ':') {
                                split.pop();
                            } else if (moduleName[i] === '.') {
                            } else {
                                moduleName =
                                    split.join('.') +
                                    '.' +
                                    moduleName.substring(i);
                                console.log('absolute module name', moduleName);
                                break;
                            }
                        }
                    }

                    if (moduleName.startsWith('🔗')) {
                        const [id, tag] = moduleName
                            .substring('🔗'.length)
                            .split('.');
                        const bot = botsState[id];
                        if (bot && tag) {
                            resolutions.push({
                                resolvedFileName: getModelUriFromId(
                                    id,
                                    tag,
                                    null
                                ),
                            });
                            continue;
                        }
                    }

                    const lastIndex = moduleName.lastIndexOf('.');
                    if (lastIndex >= 0) {
                        const system = moduleName.substring(0, lastIndex);
                        const tag = moduleName.substring(lastIndex + 1);

                        let foundBot = false;
                        for (let botId in botsState) {
                            const bot = botsState[botId];
                            if (bot && bot.tags['system'] === system) {
                                const botSystem = calculateStringTagValue(
                                    null,
                                    bot,
                                    'system',
                                    null
                                );

                                if (botSystem === system) {
                                    console.log(
                                        'found module',
                                        system,
                                        getModelUriFromId(botId, tag, null)
                                    );
                                    foundBot = true;
                                    resolutions.push({
                                        resolvedFileName: getModelUriFromId(
                                            botId,
                                            tag,
                                            null
                                        ),
                                    });
                                    break;
                                }
                            }
                        }

                        if (foundBot) {
                            continue;
                        }
                    }
                }

                console.log('not found');
                resolutions.push(undefined);
            }
        }

        // ts.loadWithModeAwareCache<ResolvedModuleFull>(Debug.checkEachDefined(moduleNames), Debug.checkDefined(containingSourceFile), containingFile, redirectedReference, loader);
        // console.log('Resolve Module Names', moduleNames, containingFile, reusedNames, redirectedReference, options, containingSourceFile);
        return resolutions;
    }

    onStateUpdated(simId: string, update: StateUpdatedEvent) {
        let botsState = this._botStates[simId] ?? {};
        botsState = applyUpdates(botsState, update);

        this._botStates[simId] = botsState;
    }

    private _findBotsFromSim(botId: string): PrecalculatedBotsState {
        for (let state of Object.values(this._botStates)) {
            if (state[botId]) {
                return state;
            }
        }
    }
}

// export function customTSWorkerFactory(TypeScriptWorker: any, ts: any, libFileMap: any) {
//     console.log('Create custom TS Worker');
//     return class CustomTypeScriptWorker extends TypeScriptWorker {

//         resolveModuleNames?(moduleNames: string[], containingFile: string, reusedNames: string[] | undefined, redirectedReference: ResolvedProjectReference | undefined, options: CompilerOptions, containingSourceFile?: SourceFile): (ResolvedModule | undefined)[] {
//             console.log('Resolve Module Names', moduleNames, containingFile, reusedNames, redirectedReference, options, containingSourceFile);
//             return [];
//         }

//         addBotIndexEvents(events: BotIndexEvent[]) {
//             console.log('Update Bot State', events);
//         }

//     }
// }
