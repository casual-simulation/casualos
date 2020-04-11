import { AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    BotCalculationContext,
    isFormula,
    calculateBotValue,
    isArray,
    parseArray,
} from '@casual-simulation/aux-common';
import { Arrow3D } from '../Arrow3D';
import { Color } from 'three';
import { AuxBotVisualizerFinder } from '../../../shared/AuxBotVisualizerFinder';
import { Wall3D } from '../Wall3D';
import { buildSRGBColor } from '../SceneUtils';

export class LineToDecorator extends AuxBot3DDecoratorBase {
    /**
     * The optional arrows for the bot.
     */
    arrows: Arrow3D[];
    walls: Wall3D[];

    private _arrows: Map<AuxBot3D, Arrow3D>;
    private _walls: Map<AuxBot3D, Wall3D>;
    private _finder: AuxBotVisualizerFinder;
    private _lineColor: Color;
    private _lineColorValue: any;

    constructor(bot3D: AuxBot3D, botFinder: AuxBotVisualizerFinder) {
        super(bot3D);
        this._finder = botFinder;
        this._arrows = new Map();
        this._walls = new Map();
    }

    botUpdated(calc: BotCalculationContext): void {}

    frameUpdate(calc: BotCalculationContext): void {
        this._tagUpdateLine(calc);
    }

    dispose(): void {
        if (this.arrows) {
            this.arrows.forEach(a => {
                a.dispose();
            });
        }

        if (this.walls) {
            this.walls.forEach(a => {
                a.dispose();
            });
        }
    }

    private _tagUpdateLine(calc: BotCalculationContext): void {
        if (!this._finder) {
            return;
        }

        let lineTo = this.bot3D.bot.tags['auxLineTo'];
        let validLineIds: number[];

        if (
            !lineTo &&
            (!this.arrows || this.arrows.length === 0) &&
            (!this.walls || this.walls.length === 0)
        ) {
            return;
        }

        if (lineTo) {
            validLineIds = [];

            // Local function for setting up a line. Will add the targetBotId to the validLineIds array if successful.

            let lineColorValue = calculateBotValue(
                calc,
                this.bot3D.bot,
                'auxLineColor'
            );

            if (lineColorValue !== this._lineColorValue) {
                this._lineColorValue = lineColorValue;

                if (lineColorValue) {
                    this._lineColor = buildSRGBColor(lineColorValue);
                } else {
                    this._lineColor = new Color();
                }
            }

            // Parse the line.to tag.
            // It can either be a formula or a handtyped string.
            if (isFormula(lineTo)) {
                let calculatedValue = calculateBotValue(
                    calc,
                    this.bot3D.bot,
                    'auxLineTo'
                );

                if (Array.isArray(calculatedValue)) {
                    // Array of objects.
                    calculatedValue.forEach(o => {
                        if (o) {
                            this._trySetupLines(
                                calc,
                                o.id,
                                validLineIds,
                                this._lineColor
                            );
                        }
                    });
                } else {
                    // Single object.
                    if (calculatedValue) {
                        this._trySetupLines(
                            calc,
                            calculatedValue.id,
                            validLineIds,
                            this._lineColor
                        );
                    }
                }
            } else {
                if (isArray(lineTo)) {
                    // Array of strings.
                    parseArray(<string>lineTo).forEach(s => {
                        this._trySetupLines(
                            calc,
                            s,
                            validLineIds,
                            this._lineColor
                        );
                    });
                } else {
                    // Single string.
                    this._trySetupLines(
                        calc,
                        <string>lineTo,
                        validLineIds,
                        this._lineColor
                    );
                }
            }
        }

        let style = this.bot3D.bot.tags['auxLineStyle'];
        let styleValue: string;

        if (isFormula(style)) {
            styleValue = calculateBotValue(
                calc,
                this.bot3D.bot,
                'auxLineStyle'
            );
        } else if (style != undefined) {
            styleValue = <string>style;
        }

        if (typeof styleValue !== 'undefined' && styleValue !== null) {
            styleValue = styleValue.toString().toLowerCase();
        }

        if (!styleValue || styleValue !== 'wall') {
            if (this.arrows) {
                // Filter out lines that are no longer being used.
                this.arrows = this.arrows.filter(a => {
                    if (a && a.targetBot3d) {
                        if (
                            validLineIds &&
                            validLineIds.indexOf(a.targetBot3d.id) >= 0
                        ) {
                            // This line is active, keep it in.
                            return true;
                        }
                    }
                    // This line is no longer used, filter it out.
                    this.bot3D.remove(a);
                    this._arrows.delete(a.targetBot3d);
                    a.dispose();
                    return false;
                });
            }
        } else {
            if (this.arrows != undefined) {
                for (let i = this.arrows.length - 1; i >= 0; i--) {
                    this.bot3D.remove(this.arrows[i]);
                    this.arrows.pop();
                }
                this._arrows.clear();
            }
        }

        if (styleValue === 'wall') {
            if (this.walls) {
                // Filter out lines that are no longer being used.
                this.walls = this.walls.filter(a => {
                    if (a && a.targetBot3d) {
                        if (
                            validLineIds &&
                            validLineIds.indexOf(a.targetBot3d.id) >= 0
                        ) {
                            // This line is active, keep it in.
                            return true;
                        }
                    }
                    // This line is no longer used, filter it out.
                    this.bot3D.remove(a);
                    this._walls.delete(a.targetBot3d);
                    a.dispose();
                    return false;
                });
            }
        } else {
            if (this.walls != undefined) {
                for (let i = this.walls.length - 1; i >= 0; i--) {
                    this.bot3D.remove(this.walls[i]);
                    this.walls.pop();
                }

                this._walls.clear();
            }
        }
    }

    private _trySetupLines(
        calc: BotCalculationContext,
        targetBotId: string,
        validLineIds: number[],
        color?: Color
    ) {
        // Undefined target botd id.
        if (!targetBotId) return;

        // Can't create line to self.
        // TODO: Make it so you can make lines to other visualizations of this
        if (this.bot3D.bot.id === targetBotId) return;

        const bots = this._finder.findBotsById(targetBotId);
        bots.forEach(f =>
            this._trySetupLine(calc, <AuxBot3D>f, validLineIds, color)
        );
    }

    private _trySetupLine(
        calc: BotCalculationContext,
        targetBot: AuxBot3D,
        validLineIds: number[],
        color?: Color
    ) {
        if (!targetBot) {
            // No bot found.
            return;
        }

        let style = this.bot3D.bot.tags['auxLineStyle'];
        let styleValue: string;

        if (isFormula(style)) {
            styleValue = calculateBotValue(
                calc,
                this.bot3D.bot,
                'auxLineStyle'
            );
        } else if (style != undefined) {
            styleValue = <string>style;
        }

        if (typeof styleValue !== 'undefined' && styleValue !== null) {
            styleValue = styleValue.toString().toLowerCase();
        }

        if (styleValue === 'wall') {
            // Initialize walls array if needed.
            if (!this.walls) this.walls = [];

            //if (!this.arrows) this.arrows = [];
            let targetWall: Wall3D = this._walls.get(targetBot);

            if (!targetWall) {
                // Create wall for target.
                let sourceBot = this.bot3D;
                targetWall = new Wall3D(sourceBot, targetBot);
                this.bot3D.add(targetWall);
                this.walls.push(targetWall);
                this._walls.set(targetBot, targetWall);
            }

            if (targetWall) {
                targetWall.setColor(color);
                targetWall.update(calc);
                // Add the target bot id to the valid ids list.
                validLineIds.push(targetBot.id);
            }
        } else {
            // Initialize arrows array if needed.
            if (!this.arrows) this.arrows = [];

            let hasArrowTip = styleValue !== 'line';

            let targetArrow: Arrow3D = this._arrows.get(targetBot);

            if (!targetArrow) {
                // Create arrow for target.
                let sourceBot = this.bot3D;
                targetArrow = new Arrow3D(sourceBot, targetBot);
                this.bot3D.add(targetArrow);
                this.arrows.push(targetArrow);
                this._arrows.set(targetBot, targetArrow);
            }

            if (targetArrow) {
                targetArrow.setColor(color);
                targetArrow.setTipState(hasArrowTip);
                targetArrow.update(calc);
                // Add the target bot id to the valid ids list.
                validLineIds.push(targetBot.id);
            }
        }
    }
}
