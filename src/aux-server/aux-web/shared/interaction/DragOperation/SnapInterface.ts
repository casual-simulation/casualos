import { SnapAxis, SnapPoint, SnapTarget, SnapGrid } from '@casual-simulation/aux-common';
import { sortBy } from 'lodash';

export interface SnapOptions {
    snapGround: boolean;
    snapGrid: boolean;
    snapFace: boolean;
    snapBots: boolean;
    snapGrids: SnapGrid[];
    snapPoints: SnapPoint[];
    snapAxes: SnapAxis[];
    botId: string;
}

export interface SnapBotsInterface {
    /**
     * Adds snap targets for the given bot.
     * @param botId The ID of the bot that the targets should be in effect for. If null, then the targets will be used globally.
     * @param targets The targets.
     */
    addSnapTargets(botId: string, targets: SnapTarget[]): void;

    /**
     * Adds snap grids for the given bot.
     * @param botId The ID of the bot that the targets should be in effect for. If null, then the targets will be used globally.
     * @param grids The grids.
     */
    addSnapGrids(botId: string, grids: SnapGrid[]): void;

    /**
     * Gets the global snap options.
     */
    globalSnapOptions(): SnapOptions;

    /**
     * Gets the snap options for the given bot.
     * Returns null if there are no options for the bot.
     * @param botId The ID of the bot.
     */
    botSnapOptions(botId: string): SnapOptions;
}

export class SnapBotsHelper implements SnapBotsInterface {
    private _snapOptions = new Map<string, SnapOptions>();

    addSnapTargets(botId: string, targets: SnapTarget[]) {
        let options = this._snapOptions.get(botId ?? null);
        if (!options) {
            options = {
                snapGround: targets.some((t) => t === 'ground'),
                snapGrid: targets.some((t) => t === 'grid'),
                snapFace: targets.some((t) => t === 'face'),
                snapBots: targets.some((t) => t === 'bots'),
                snapPoints: targets.filter(
                    (t) => typeof t === 'object' && 'position' in t
                ) as SnapOptions['snapPoints'],
                snapAxes: targets.filter(
                    (t) =>
                        typeof t === 'object' &&
                        'direction' in t &&
                        'origin' in t
                ) as SnapOptions['snapAxes'],
                botId: botId,
                snapGrids: [],
            };
            this._snapOptions.set(botId ?? null, options);
        } else {
            for (let target of targets) {
                if (target === 'ground') {
                    options.snapGround = true;
                } else if (target === 'grid') {
                    options.snapGrid = true;
                } else if (target === 'face') {
                    options.snapFace = true;
                } else if (target === 'bots') {
                    options.snapBots = true;
                } else {
                    if ('direction' in target) {
                        options.snapAxes.push(target);
                    } else {
                        options.snapPoints.push(target);
                    }
                }
            }
        }
    }

    addSnapGrids(botId: string, grids: SnapGrid[]) {
        let options = this._snapOptions.get(botId ?? null);
        if (!options) {
            options = {
                snapGround: false,
                snapGrid: false,
                snapFace: false,
                snapBots: false,
                snapPoints: [],
                snapAxes: [],
                botId: botId,
                snapGrids: sortBy(grids, g => -(g.priority ?? 0))
            };

            this._snapOptions.set(botId ?? null, options);
        } else {
            options.snapGrids.push(...grids);
            options.snapGrids = sortBy(options.snapGrids, g => -(g.priority ?? 0));
        }
    }

    globalSnapOptions() {
        return this._snapOptions.get(null);
    }

    botSnapOptions(botId: string): SnapOptions {
        if (!botId) {
            return null;
        }
        return this._snapOptions.get(botId) ?? null;
    }
}
