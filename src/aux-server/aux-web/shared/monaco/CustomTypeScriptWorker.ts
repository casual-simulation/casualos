import type {
    PrecalculatedBotsState,
    StateUpdatedEvent,
} from '@casual-simulation/aux-common';
import {
    applyUpdates,
    calculateStringTagValue,
} from '@casual-simulation/aux-common';
import type { ts } from '@casual-simulation/monaco-editor/esm/vs/language/typescript/ts.worker';
import { TypeScriptWorker } from '@casual-simulation/monaco-editor/esm/vs/language/typescript/ts.worker';
import type { worker } from '@casual-simulation/monaco-editor';
import { getIdFromModelUri, getModelUriFromId } from '../MonacoUtils';

const botStates: {
    [id: string]: PrecalculatedBotsState;
} = {};

export function onStateUpdated(simId: string, update: StateUpdatedEvent) {
    let botsState = botStates[simId] ?? {};
    botsState = applyUpdates(botsState, update);
    botStates[simId] = botsState;
}

function findBotsFromSim(botId: string): PrecalculatedBotsState {
    for (let state of Object.values(botStates)) {
        if (state[botId]) {
            return state;
        }
    }
}

export class CustomTypeScriptWorker extends TypeScriptWorker {
    constructor(ctx: worker.IWorkerContext, createData: any) {
        super(ctx, createData);
    }

    resolveModuleNames(
        moduleNames: string[],
        containingFile: string,
        reusedNames: string[] | undefined,
        redirectedReference: ts.ResolvedProjectReference | undefined,
        options: ts.CompilerOptions,
        containingSourceFile?: ts.SourceFile
    ): (ts.ResolvedModule | undefined)[] {
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
                    const botsState = findBotsFromSim(botInfo.id);

                    if (!botsState) {
                        console.log('Could not find bot state for', botInfo.id);
                        resolutions.push(undefined);
                        continue;
                    }

                    const isRelativeImport =
                        moduleName.startsWith('.') ||
                        moduleName.startsWith(':');
                    if (isRelativeImport) {
                        const bot = botsState[botInfo.id];
                        if (!bot) {
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
                                /* empty */
                            } else {
                                moduleName =
                                    split.join('.') +
                                    '.' +
                                    moduleName.substring(i);
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

                resolutions.push(undefined);
            }
        }

        // ts.loadWithModeAwareCache<ResolvedModuleFull>(Debug.checkEachDefined(moduleNames), Debug.checkDefined(containingSourceFile), containingFile, redirectedReference, loader);
        // console.log('Resolve Module Names', moduleNames, containingFile, reusedNames, redirectedReference, options, containingSourceFile);
        return resolutions;
    }
}
