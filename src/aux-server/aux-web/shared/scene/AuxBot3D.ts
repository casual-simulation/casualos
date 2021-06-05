import { GameObject } from './GameObject';
import {
    Object3D,
    Box3,
    Sphere,
    Group,
    Color,
    Vector3,
    Quaternion,
    Matrix4,
    Euler,
} from '@casual-simulation/three';
import {
    Bot,
    BotCalculationContext,
    calculateGridScale,
    isBotPointable,
    isBotFocusable,
    LocalActions,
} from '@casual-simulation/aux-common';
import { AuxBot3DDecorator } from './AuxBot3DDecorator';
import { DimensionGroup3D } from './DimensionGroup3D';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import { DebugObjectManager } from './debugobjectmanager/DebugObjectManager';
import { AuxBotVisualizer } from './AuxBotVisualizer';
import { buildSRGBColor, safeSetParent } from './SceneUtils';
import { MapSimulation3D } from 'aux-web/aux-player/scene/MapSimulation3D';
import { CoordinateSystem } from './CoordinateSystem';

/**
 * Defines a class that is able to display Aux bots.
 */
export class AuxBot3D extends GameObject implements AuxBotVisualizer {
    /**
     * The dimension this bot visualization was created for.
     */
    dimension: string;

    /**
     * The dimension group that this visualization belongs to.
     */
    dimensionGroup: DimensionGroup3D;

    /**
     * The bot for the mesh.
     */
    bot: Bot;

    /**
     * The container for the bot.
     */
    container: Group;

    /**
     * The container that applies scales to the bot.
     */
    scaleContainer: Group;

    /**
     * The container that contains other bots.
     */
    transformContainer: Group;

    /**
     * The things that are displayed by this bot.
     */
    display: Group;

    /**
     * The list of decorators that this bot is using.
     */
    decorators: AuxBot3DDecorator[];

    private _frameUpdateList: AuxBot3DDecorator[];
    private _boundingBox: Box3 = null;
    private _boundingSphere: Sphere = null;
    private _unitBoundingBox: Box3 = null;
    private _unitBoundingSphere: Sphere = null;
    private _updatesInFrame: number = 0;
    private _isOnGrid = true;

    /**
     * Returns a copy of the bot 3d's current bounding box.
     */
    get boundingBox(): Box3 {
        if (!this._boundingBox) {
            this._computeBoundingObjects();
        }

        return this._boundingBox.clone();
    }

    /**
     * Returns a copy of the bot 3d's current bounding sphere.
     */
    get boundingSphere(): Sphere {
        if (!this._boundingSphere) {
            this._computeBoundingObjects();
        }
        return this._boundingSphere.clone();
    }

    /**
     * Returns a copy of the bot 3d's bounding box which simply represents the
     * virtual bounding box that the bot uses.
     */
    get unitBoundingBox(): Box3 {
        if (!this._unitBoundingBox) {
            this._computeBoundingObjects();
        }

        return this._unitBoundingBox.clone();
    }

    /**
     * Returns a copy of the bot 3d's bounding sphere which simply represents the
     * virtual bounding box that the bot uses.
     */
    get unitBoundingSphere(): Sphere {
        if (!this._unitBoundingSphere) {
            this._computeBoundingObjects();
        }

        return this._unitBoundingSphere.clone();
    }

    get gridScale(): number {
        if (this.isOnGrid) {
            return this.calculateGridScale();
        }
        return 1;
    }

    /**
     * Gets whether the bot is placed directly on the grid (true) or if it is nested in another bot (false).
     */
    get isOnGrid(): boolean {
        return this._isOnGrid;
    }

    /**
     * Gets the coordinate system that positions and rotations should be output in.
     */
    get targetCoordinateSystem(): CoordinateSystem {
        return (
            this.dimensionGroup?.simulation3D?.targetCoordinateSystem ??
            CoordinateSystem.Y_UP
        );
    }

    /**
     * A matrix that should be used to transform the bot's position from AUX coordinates to Three.js coordinates.
     * If null, then the default process will be used. (swap Y and Z axes)
     */
    get coordinateTransformer(): (pos: {
        x: number;
        y: number;
        z: number;
    }) => Matrix4 {
        const sim = this.dimensionGroup?.simulation3D;
        if (sim.coordinateTransformer) {
            return sim.coordinateTransformer;
        }
        return null;
    }

    /**
     * A matrix that should be used to transform the bot's position from world coordinates to AUX coordinates.
     */
    get inverseCoordinateTransformer(): (pos: {
        x: number;
        y: number;
        z: number;
    }) => Matrix4 {
        const sim = this.dimensionGroup?.simulation3D;
        if (sim.inverseCoordinateTransformer) {
            return sim.inverseCoordinateTransformer;
        }
        return null;
    }

    /**
     * Calculates the grid scale that this bot would have if it was on the grid.
     * @returns
     */
    calculateGridScale() {
        const group = this.dimensionGroup;
        const sim = group ? group.simulation3D : null;
        const gridScale = sim
            ? sim.getGridScale(this)
            : calculateGridScale(null, null);
        return gridScale;
    }

    constructor(
        bot: Bot,
        dimensionGroup: DimensionGroup3D,
        dimension: string,
        colliders: Object3D[],
        decoratorFactory: AuxBot3DDecoratorFactory
    ) {
        super();
        this.bot = bot;
        this.dimensionGroup = dimensionGroup;
        this.colliders = colliders;
        this.dimension = dimension;
        this.container = new Group();
        this.display = new Group();
        this.scaleContainer = new Group();
        this.transformContainer = new Group();
        this.add(this.container);
        this.container.add(this.scaleContainer);
        this.scaleContainer.add(this.display);
        this.scaleContainer.add(this.transformContainer);

        this.decorators = decoratorFactory.loadDecorators(this);
        this.updateFrameUpdateList();
    }

    /**
     * Forces the bot to update the bot's bounding box and sphere.
     */
    forceComputeBoundingObjects(): void {
        this._computeBoundingObjects();
    }

    /**
     * Update the internally cached representation of this aux bot 3d's bounding box and sphere.
     */
    private _computeBoundingObjects(): void {
        if (this._unitBoundingBox === null) {
            this._unitBoundingBox = new Box3();
        }

        // Set to the virtual box.
        const worldPosition = new Vector3();
        this.display.getWorldPosition(worldPosition);
        const worldScale = new Vector3();
        this.scaleContainer.getWorldScale(worldScale);
        this._unitBoundingBox.setFromCenterAndSize(worldPosition, worldScale);

        if (this._unitBoundingSphere === null) {
            this._unitBoundingSphere = new Sphere();
        }

        this._unitBoundingBox.getBoundingSphere(this._unitBoundingSphere);

        // Calculate Bounding Box
        if (this._boundingBox === null) {
            this._boundingBox = new Box3();
        }

        this._boundingBox.setFromObject(this.display);

        if (this._boundingBox.isEmpty()) {
            this._boundingBox.copy(this._unitBoundingBox);
        }

        // Calculate Bounding Sphere
        if (this._boundingSphere === null) {
            this._boundingSphere = new Sphere();
        }
        this._boundingBox.getBoundingSphere(this._boundingSphere);
    }

    /**
     * Sets the parent of this bot.
     * @param parent The parent that this bot should have.
     */
    setParent(logicalParent: AuxBot3D | DimensionGroup3D | Object3D) {
        if (logicalParent instanceof DimensionGroup3D) {
            this._isOnGrid = true;
            logicalParent.display.add(this);
        } else if (logicalParent instanceof AuxBot3D) {
            if (safeSetParent(this, logicalParent.transformContainer)) {
                this._isOnGrid = false;
            }
        } else {
            if (safeSetParent(this, logicalParent)) {
                this._isOnGrid = false;
            }
        }
    }

    /**
     * Notifies the mesh that the given bot has been added to the state.
     * @param bot The bot.
     * @param calc The calculation context.
     */
    botAdded(bot: Bot, calc: BotCalculationContext) {}

    /**
     * Notifies this mesh that the given bot has been updated.
     * @param bot The bot that was updated.
     * @param updates The updates that happened on the bot.
     * @param calc The calculation context.
     */
    botUpdated(bot: Bot, tags: Set<string>, calc: BotCalculationContext) {
        if (this._shouldUpdate(calc, bot)) {
            this._updatesInFrame += 1;
            if (bot.id === this.bot.id) {
                this.bot = bot;
                this._boundingBox = null;
                this._boundingSphere = null;

                this.pointable = isBotPointable(calc, this.bot);
                this.focusable = isBotFocusable(calc, this.bot);
            }
            for (let i = 0; i < this.decorators.length; i++) {
                this.decorators[i].botUpdated(calc);
            }

            if (DebugObjectManager.enabled && bot.id === this.bot.id) {
                DebugObjectManager.drawBox3(
                    this.boundingBox,
                    buildSRGBColor('#999'),
                    0.1
                );
            }
        }
    }

    /**
     * Notifies the mesh that itself was removed.
     * @param calc The calculation context.
     */
    botRemoved(id: string, calc: BotCalculationContext) {
        for (let i = 0; i < this.decorators.length; i++) {
            this.decorators[i].botRemoved(calc);
        }
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this.decorators) {
            for (let decorator of this._frameUpdateList) {
                decorator.frameUpdate(calc);
            }
        }
        if (this._updatesInFrame > 1 && DebugObjectManager.enabled) {
            console.warn(
                '[AuxBot3D] More than 1 update this frame:',
                this._updatesInFrame
            );
        }
        this._updatesInFrame = 0;
    }

    localEvent(event: LocalActions, calc: BotCalculationContext): void {
        if (this.decorators) {
            for (let decorator of this.decorators) {
                if (decorator.localEvent) {
                    decorator.localEvent(event, calc);
                }
            }
        }
    }

    updateFrameUpdateList() {
        this._frameUpdateList = this.decorators.filter((d) => !!d.frameUpdate);
    }

    dispose() {
        super.dispose();
        if (this.decorators) {
            const decorators = this.decorators;
            this.decorators = [];
            for (let d of decorators) {
                d.dispose();
            }
        }
    }

    private _shouldUpdate(calc: BotCalculationContext, bot: Bot): boolean {
        return bot.id === this.bot.id;
    }
}
