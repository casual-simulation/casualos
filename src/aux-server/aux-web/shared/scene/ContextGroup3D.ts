import { GameObject } from './GameObject';
import {
    Bot,
    BotCalculationContext,
    TagUpdatedEvent,
    hasValue,
    calculateBotValue,
    AuxDomain,
    getBotConfigContexts,
} from '@casual-simulation/aux-common';
import { difference, flatMap } from 'lodash';
import { Context3D } from './Context3D';
import { GridChecker } from './grid/GridChecker';
import { Object3D, Group } from 'three';
import { AuxFile3DDecoratorFactory } from './decorators/AuxFile3DDecoratorFactory';
import { Simulation3D } from './Simulation3D';

/**
 * Defines a class that represents a visualization of a context for the AUX Builder.
 *
 * Note that each aux file gets its own builder context.
 * Whether or not anything is visualized in the context depends on the file tags.
 */
export class ContextGroup3D extends GameObject {
    /**
     * The file that this context represents.
     */
    file: Bot;

    /**
     * The group that contains the contexts that this group is displaying.
     */
    display: Group;

    /**
     * The contexts that are represented by this builder context.
     */
    contexts: Map<string, Context3D>;

    /**
     * The domain that the group is for.
     */
    domain: AuxDomain;

    /**
     * The simulation the group is for.
     */
    simulation3D: Simulation3D;

    protected _childColliders: Object3D[];
    protected _decoratorFactory: AuxFile3DDecoratorFactory;

    /**
     * Gets the colliders that should be used for this context group.
     */
    get groupColliders() {
        return super.colliders;
    }

    /**
     * Sets the colliders that should be used for this context group.
     */
    set groupColliders(value: Object3D[]) {
        super.colliders = value;
    }

    get colliders() {
        return flatMap([this._childColliders, this.groupColliders]);
    }

    set colliders(value: Object3D[]) {
        this._childColliders = value;
    }

    /**
     * Creates a new Builder Context 3D Object.
     * @param The file that this builder represents.
     */
    constructor(
        simulation3D: Simulation3D,
        file: Bot,
        domain: AuxDomain,
        decoratorFactory: AuxFile3DDecoratorFactory
    ) {
        super();
        this.simulation3D = simulation3D;
        this.domain = domain;
        this.file = file;
        this.display = new Group();
        this.contexts = new Map();
        this._decoratorFactory = decoratorFactory;

        this.add(this.display);
    }

    /**
     * Gets the bots that are contained by this builder context.
     */
    getFiles() {
        return flatMap([...this.contexts.values()], c => [...c.bots.values()]);
    }

    frameUpdate(calc: BotCalculationContext) {
        this.contexts.forEach(context => {
            context.frameUpdate(calc);
        });
    }

    /**
     * Notifies the builder context that the given file was added to the state.
     * @param file The file that was added.
     * @param calc The file calculation context that should be used.
     */
    async botAdded(file: Bot, calc: BotCalculationContext) {
        if (file.id === this.file.id) {
            this.file = file;
            await this._updateThis(file, [], calc);
            this._updateContexts(file, calc);
        }

        this.contexts.forEach(context => {
            context.botAdded(file, calc);
        });
    }

    /**
     * Notifies the builder context that the given file was updated.
     * @param file The file that was updated.
     * @param updates The updates that happened on the file.
     * @param calc The file calculation context that should be used.
     */
    async botUpdated(
        file: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        if (file.id === this.file.id) {
            this.file = file;
            await this._updateThis(file, updates, calc);
            this._updateContexts(file, calc);
        }

        this.contexts.forEach(context => {
            context.botUpdated(file, updates, calc);
        });
    }

    /**
     * Notifies the builder context that the given file was removed from the state.
     * @param id The ID of the file that was removed.
     * @param calc The file calculation context that should be used.
     */
    botRemoved(id: string, calc: BotCalculationContext) {
        this.contexts.forEach(context => {
            context.botRemoved(id, calc);
        });
    }

    dispose(): void {
        this.contexts.forEach(context => {
            context.dispose();
        });
    }

    /**
     * Updates the contexts that this context group should be displaying.
     * @param file The context file.
     * @param calc The file calculation context that should be used.
     */
    private _updateContexts(file: Bot, calc: BotCalculationContext) {
        const contexts = this._getContextsThatShouldBeDisplayed(file, calc);
        // TODO: Handle scenarios where builder.context is empty or null
        if (contexts) {
            this._addContexts(file, contexts, calc);
        }
    }

    protected _getContextsThatShouldBeDisplayed(
        file: Bot,
        calc: BotCalculationContext
    ): string[] {
        return getBotConfigContexts(calc, file);
    }

    protected async _updateThis(
        file: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        this.updateMatrixWorld(true);
    }

    private _addContexts(
        file: Bot,
        newContexts: string | string[],
        calc: BotCalculationContext
    ) {
        let contexts: string[];
        if (Array.isArray(newContexts)) {
            contexts = newContexts;
        } else if (typeof newContexts === 'string') {
            contexts = [newContexts];
        }

        if (contexts) {
            const currentContexts = this.currentContexts();
            const missingContexts = difference(contexts, currentContexts);
            const removedContexts = difference(currentContexts, contexts);
            const realNewContexts = missingContexts.map(c =>
                this._createContext3d(c)
            );

            realNewContexts.forEach(c => {
                // console.log(`[ContextGroup3D] Add context ${c.context} to group ${this.file.id}.`);
                this.contexts.set(c.context, c);
                this.display.add(c);

                calc.objects.forEach(o => {
                    c.botAdded(o, calc);
                });
            });
            removedContexts.forEach(c => {
                // console.log(`[ContextGroup3D] Remove context ${c} from group ${this.file.id}.`);
                const context = this.contexts.get(c);
                if (typeof context !== 'undefined') {
                    context.dispose();
                    this.contexts.delete(c);
                    this.display.remove(context);
                }
            });
        }
    }

    protected _createContext3d(context: string): Context3D {
        return new Context3D(
            context,
            this,
            this.domain,
            this._childColliders,
            this._decoratorFactory
        );
    }

    private currentContexts(): string[] {
        return [...this.contexts.keys()];
    }
}
