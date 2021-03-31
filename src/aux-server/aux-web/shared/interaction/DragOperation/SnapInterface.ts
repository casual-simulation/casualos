import { SnapPoint, SnapTarget } from '@casual-simulation/aux-common';

export interface SnapOptions {
    snapGround: boolean;
    snapGrid: boolean;
    snapFace: boolean;
    snapBots: boolean;
    snapPoints: SnapPoint[];
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
                    (t) => typeof t === 'object'
                ) as SnapOptions['snapPoints'],
                botId: botId,
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
                    options.snapPoints.push(target);
                }
            }
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
