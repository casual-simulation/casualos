import { GameObject } from './GameObject';
import { AuxFile } from '@casual-simulation/aux-common/aux-format';
import { Object3D, Box3, Sphere, Group, Color } from 'three';
import {
    Bot,
    TagUpdatedEvent,
    BotCalculationContext,
    AuxDomain,
    isBotInContext,
    GLOBALS_FILE_ID,
} from '@casual-simulation/aux-common';
import { AuxBot3DDecorator } from './AuxBot3DDecorator';
import { ContextGroup3D } from './ContextGroup3D';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import { DebugObjectManager } from './debugobjectmanager/DebugObjectManager';

/**
 * Defines a class that is able to display Aux bots.
 */
export class AuxBot3D extends GameObject {
    /**
     * The context this bot visualization was created for.
     */
    context: string;

    /**
     * The domain that this bot visualization is in.
     */
    domain: AuxDomain;

    /**
     * The context group that this visualization belongs to.
     */
    contextGroup: ContextGroup3D;

    /**
     * The bot for the mesh.
     */
    bot: Bot;

    /**
     * The things that are displayed by this bot.
     */
    display: Group;

    /**
     * The list of decorators that this bot is using.
     */
    decorators: AuxBot3DDecorator[];

    private _boundingBox: Box3 = null;
    private _boundingSphere: Sphere = null;

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

    constructor(
        bot: Bot,
        contextGroup: ContextGroup3D,
        context: string,
        domain: AuxDomain,
        colliders: Object3D[],
        decoratorFactory: AuxBot3DDecoratorFactory
    ) {
        super();
        this.bot = bot;
        this.domain = domain;
        this.contextGroup = contextGroup;
        this.colliders = colliders;
        this.context = context;
        this.display = new Group();
        this.add(this.display);

        this.decorators = decoratorFactory.loadDecorators(this);
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
        // Calculate Bounding Box
        if (this._boundingBox === null) {
            this._boundingBox = new Box3();
        }

        this._boundingBox.setFromObject(this.display);

        // Calculate Bounding Sphere
        if (this._boundingSphere === null) {
            this._boundingSphere = new Sphere();
        }
        this._boundingBox.getBoundingSphere(this._boundingSphere);
    }

    /**
     * Notifies the mesh that the given bot has been added to the state.
     * @param bot The bot.
     * @param calc The calculation context.
     */
    botAdded(bot: AuxFile, calc: BotCalculationContext) {}

    /**
     * Notifies this mesh that the given bot has been updated.
     * @param bot The bot that was updated.
     * @param updates The updates that happened on the bot.
     * @param calc The calculation context.
     */
    botUpdated(
        bot: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        if (this._shouldUpdate(calc, bot)) {
            if (bot.id === this.bot.id) {
                this.bot = bot;
                this._boundingBox = null;
                this._boundingSphere = null;
            }
            for (let i = 0; i < this.decorators.length; i++) {
                this.decorators[i].botUpdated(calc);
            }

            if (DebugObjectManager.enabled && bot.id === this.bot.id) {
                DebugObjectManager.drawBox3(
                    this.boundingBox,
                    new Color('#999'),
                    0.1
                );
            }
        }
    }

    /**
     * Notifies the mesh that itself was removed.
     * @param calc The calculation context.
     */
    botRemoved(calc: BotCalculationContext) {
        for (let i = 0; i < this.decorators.length; i++) {
            this.decorators[i].botRemoved(calc);
        }
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this.decorators) {
            for (let i = 0; i < this.decorators.length; i++) {
                this.decorators[i].frameUpdate(calc);
            }
        }
    }

    dispose() {
        super.dispose();
        if (this.decorators) {
            this.decorators.forEach(d => {
                d.dispose();
            });
        }
    }

    private _shouldUpdate(calc: BotCalculationContext, bot: Bot): boolean {
        return bot.id === this.bot.id;
    }
}
