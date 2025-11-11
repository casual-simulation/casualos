/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    Bot,
    BotCalculationContext,
    PrecalculatedBot,
    BotIndexEvent,
} from '@casual-simulation/aux-common';
import { hasValue } from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';

import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import type { CameraRig } from '../../shared/scene/CameraRigFactory';
import type { Game } from '../../shared/scene/Game';
import type { PlayerGame } from './PlayerGame';
import type {
    BotDimensionEvent,
    DimensionAddedEvent,
} from '@casual-simulation/aux-vm';

import { PortalConfig } from './PortalConfig';
import type { AuxBot3D } from '../../shared/scene/AuxBot3D';
import { CompoundGrid3D } from '../../shared/scene/CompoundGrid3D';
import type { Grid3D } from '../../shared/scene/Grid3D';
import { Object3D } from '@casual-simulation/three';

export abstract class PlayerSimulation3D extends Simulation3D {
    name = 'PlayerSimulation3D';
    
    /**
     * The map of portal tags to their related groups.
     */
    private _playerDimensionGroups: Map<string, DimensionGroup3D>;

    private _portalTags: string[] = null;
    private _portalConfigs = new Map<string, PortalConfig>();
    private _primaryPortalConfig: PortalConfig;
    private _grid: CompoundGrid3D = new CompoundGrid3D();

    protected _game: PlayerGame; // Override base class game so that its cast to the Aux Player Game.

    get grid3D(): Grid3D {
        return this._grid;
    }

    get portals(): PortalConfig[] {
        return [...this._portalConfigs.values()];
    }

    get dimension(): string {
        if (this._playerDimensionGroups.size > 0) {
            let dimensions = [] as string[];
            for (let [key, group] of this._playerDimensionGroups) {
                dimensions.push(...group.dimensions.values());
            }
            return dimensions[0] || null;
        }
        return null;
    }

    get hasDimension() {
        return this.dimensions.length > 0;
    }

    get portalTags() {
        return this._portalTags;
    }

    constructor(
        portalTags: string | string[],
        game: Game,
        simulation: BrowserSimulation
    ) {
        super(game, simulation);

        if (!hasValue(portalTags)) {
            throw new Error('The portal tag must be specified');
        }

        this._portalTags =
            typeof portalTags === 'string' ? [portalTags] : portalTags.slice();
        this._playerDimensionGroups = new Map();

        this._subs.push(
            this.onDimensionGroupRemoved.subscribe((group) => {
                this._playerDimensionGroups.delete(group.portalTag);
            })
        );
    }

    getPortalConfig(portal: string) {
        return this._portalConfigs.get(portal);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMainCameraRig();
    }

    getDimensionGroupForGrid(grid: Grid3D): DimensionGroup3D {
        for (let portal of this.portals) {
            if (portal.grid3D === grid) {
                const group = this.getDimensionGroupForPortal(portal.portalTag);
                if (group) {
                    return group;
                }
            }
        }

        return null;
    }

    getDimensionGroupForPortal(portal: string): DimensionGroup3D {
        return this._playerDimensionGroups.get(portal);
    }

    getDimensionForGrid(grid: Grid3D): string {
        const group = this.getDimensionGroupForGrid(grid);
        if (group) {
            return [...group.dimensions.values()][0];
        }
        if (grid instanceof CompoundGrid3D) {
            return this.getDimensionForGrid(grid.primaryGrid);
        }
        return null;
    }

    getPortalConfigForGrid(grid: Grid3D): PortalConfig {
        for (let portal of this.portals) {
            if (portal.grid3D === grid) {
                return portal;
            }
        }

        return null;
    }

    init() {
        this._watchDimensionBot();
        super.init();
    }

    protected _getDimensionTags() {
        return this._portalTags;
    }

    protected _filterDimensionEvent(
        calc: BotCalculationContext,
        event: BotDimensionEvent
    ): boolean {
        // Only allow dimensions defined on the user's bot
        if (
            event.type === 'dimension_added' ||
            event.type === 'dimension_removed'
        ) {
            return event.dimensionBot.id === this.simulation.helper.userId;
        }
        return super._filterDimensionEvent(calc, event);
    }

    protected _filterDimensionBot(bot: Bot): boolean {
        // Only allow dimensions defined on the user's bot
        return bot.id === this.simulation.helper.userId;
    }

    protected _createDimensionGroup(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        event: DimensionAddedEvent
    ) {
        if (bot === this.simulation.helper.userBot) {
            let group = this._playerDimensionGroups.get(event.dimensionTag);
            if (group) {
                return null;
            }

            group = this._constructDimensionGroup(event.dimensionTag, bot);
            this._playerDimensionGroups.set(event.dimensionTag, group);

            // TODO: Update to support locking dimensions
            return group;
        }

        return this._constructDimensionGroup(event.dimensionTag, bot);
    }

    protected _constructDimensionGroup(
        portalTag: string,
        bot: Bot
    ): DimensionGroup3D {
        return new DimensionGroup3D(
            this,
            bot,
            'player',
            this.decoratorFactory,
            portalTag
        );
    }

    private _watchDimensionBot() {
        for (let portalTag of this._portalTags) {
            const config = this._createPortalConfig(portalTag);
            if (!this._primaryPortalConfig) {
                this._primaryPortalConfig = config;
            }
            this._bindPortalConfig(config);
            this._portalConfigs.set(portalTag, config);
            this._grid.grids.push(config.grid3D);
            this._subs.push(
                config,
                config.onGridScaleUpdated.subscribe(() => {
                    this.ensureUpdate(this.bots.map((b) => b.bot.id));
                })
            );
        }
    }

    protected _bindPortalConfig(config: PortalConfig) {
        if (config.grid3D instanceof Object3D) {
            this.add(config.grid3D);
        }
    }

    protected _createPortalConfig(portalTag: string) {
        return new PortalConfig(portalTag, this.simulation);
    }

    protected _isDimensionGroupEvent(event: BotIndexEvent) {
        return (
            super._isDimensionGroupEvent(event) ||
            (event.bot.id === this.simulation.helper.userId &&
                this._isUserDimensionGroupEvent(event))
        );
    }

    getGridScale(bot: AuxBot3D | DimensionGroup3D): number {
        let group = bot instanceof DimensionGroup3D ? bot : bot.dimensionGroup;
        let scale = 1;
        while (group) {
            const portal = group.portalTag;
            const config = this._portalConfigs.get(portal);
            if (config) {
                scale *= config.gridScale;
            }
            if (group.boundBot) {
                group = group.boundBot.dimensionGroup;
            } else {
                group = null;
            }
        }

        return scale;
    }

    getGridForBot(bot: AuxBot3D): Grid3D {
        const portal = bot.dimensionGroup.portalTag;
        const config = this._portalConfigs.get(portal);
        return config?.grid3D ?? null;
    }

    private _isUserDimensionGroupEvent(event: BotIndexEvent): boolean {
        return event.tag === 'menuPortal';
    }

    // TODO:
    // protected _removeDimension(dimension: DimensionGroup3D, removedIndex: number) {
    //     super._removeDimension(dimension, removedIndex);

    //     if (dimension === this._dimensionGroup) {
    //         this._dimensionGroup = null;
    //     }
    // }

    _onLoaded() {
        super._onLoaded();
    }

    protected _onBotAdded(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): void {
        super._onBotAdded(calc, bot);
    }

    unsubscribe() {
        this._playerDimensionGroups.clear();
        super.unsubscribe();
    }
}
