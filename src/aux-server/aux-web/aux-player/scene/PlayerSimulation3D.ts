import {
    Bot,
    BotCalculationContext,
    hasValue,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    isDimensionLocked,
    calculateGridScale,
    PrecalculatedBot,
    toast,
    calculateBotValue,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    BotIndexEvent,
    DEFAULT_INVENTORY_VISIBLE,
    getPortalConfigBotID,
    DEFAULT_PORTAL_ROTATABLE,
    DEFAULT_PORTAL_PANNABLE,
    DEFAULT_PORTAL_ZOOMABLE,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userBotChanged,
    userBotTagsChanged,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import {
    tap,
    filter,
    map,
    distinctUntilChanged,
    switchMap,
} from 'rxjs/operators';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { doesBotDefinePlayerDimension } from '../PlayerUtils';
import {
    Color,
    Texture,
    OrthographicCamera,
    PerspectiveCamera,
    MathUtils as ThreeMath,
} from 'three';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';
import {
    UpdatedBotInfo,
    BotDimensionEvent,
    DimensionAddedEvent,
    DimensionRemovedEvent,
} from '@casual-simulation/aux-vm';
import { PortalConfig } from './PortalConfig';
import { AuxBot3D } from '../../shared/scene/AuxBot3D';
import { DebugObjectManager } from '../../shared/scene/debugobjectmanager/DebugObjectManager';

export class PlayerSimulation3D extends Simulation3D {
    /**
     * The map of portal tags to their related groups.
     */
    private _playerDimensionGroups: Map<string, DimensionGroup3D>;

    private _portalTags: string[] = null;
    private _portalConfigs = new Map<string, PortalConfig>();
    private _primaryPortalConfig: PortalConfig;

    protected _game: PlayerGame; // Override base class game so that its cast to the Aux Player Game.

    get primaryPortal() {
        return this._primaryPortalConfig;
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

    get portalTag() {
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
            typeof portalTags === 'string' ? [portalTags] : portalTags;
        this._playerDimensionGroups = new Map();

        this._subs.push(
            this.onDimensionGroupRemoved.subscribe(group => {
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

    init() {
        super.init();
        this._watchDimensionBot();
    }

    protected _frameUpdateCore(calc: BotCalculationContext) {
        super._frameUpdateCore(calc);
        if (DebugObjectManager.enabled) {
            for (let [key, config] of this._portalConfigs) {
                config.grid3D.debugDrawTilePoints(-5, 5, -5, 5);
            }
        }
        // this.grid3D.update();
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

    protected _createDimensionGroup(
        calc: BotCalculationContext,
        bot: PrecalculatedBot,
        event: DimensionAddedEvent
    ) {
        let group = this._playerDimensionGroups.get(event.dimensionTag);
        if (group) {
            return null;
        }

        group = this._constructDimensionGroup(event.dimensionTag);
        this._playerDimensionGroups.set(event.dimensionTag, group);

        // TODO: Update to support locking dimensions
        return group;
    }

    protected _constructDimensionGroup(portalTag: string) {
        return new DimensionGroup3D(
            this,
            this.simulation.helper.userBot,
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
            this.add(config.grid3D);
            this._portalConfigs.set(portalTag, config);
            this._subs.push(
                config,
                config.onGridScaleUpdated.subscribe(() => {
                    this.ensureUpdate(this.bots.map(b => b.bot.id));
                })
            );
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

    getGridScale(bot: AuxBot3D): number {
        const portal = bot.dimensionGroup.portalTag;
        const config = this._portalConfigs.get(portal);
        return config ? config.gridScale : calculateGridScale(null, null);
    }

    private _isUserDimensionGroupEvent(event: BotIndexEvent): boolean {
        return event.tag === 'auxMenuPortal';
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
