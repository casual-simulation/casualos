import { GameObject } from './GameObject';
import {
    Bot,
    BotCalculationContext,
    calculateBotValue,
    TagUpdatedEvent,
    AuxDomain,
    isBotInContext,
    getBotConfigContexts,
    isConfigForContext,
    GLOBALS_FILE_ID,
} from '@casual-simulation/aux-common';
import { Object3D, SceneUtils } from 'three';
import { AuxFile3D } from './AuxFile3D';
import { ContextGroup3D } from './ContextGroup3D';
import { AuxFile3DDecoratorFactory } from './decorators/AuxFile3DDecoratorFactory';

/**
 * Defines a class that represents the visualization of a context.
 */
export class Context3D extends GameObject {
    static debug: boolean = false;

    /**
     * The context that this object represents.
     */
    context: string;

    /**
     * The domain this object is in.
     */
    domain: AuxDomain;

    /**
     * The bots that are in this context.
     */
    bots: Map<string, AuxFile3D>;

    /**
     * The group that this context belongs to.
     */
    contextGroup: ContextGroup3D;

    private _decoratorFactory: AuxFile3DDecoratorFactory;

    /**
     * Creates a new context which represents a grouping of bots.
     * @param context The tag that this context represents.
     * @param colliders The array that new colliders should be added to.
     */
    constructor(
        context: string,
        group: ContextGroup3D,
        domain: AuxDomain,
        colliders: Object3D[],
        decoratorFactory: AuxFile3DDecoratorFactory
    ) {
        super();
        this.context = context;
        this.colliders = colliders;
        this.domain = domain;
        this.contextGroup = group;
        this.bots = new Map();
        this._decoratorFactory = decoratorFactory;
    }

    /**
     * Notifies this context that the given file was added to the state.
     * @param file The file.
     * @param calc The calculation context that should be used.
     */
    botAdded(file: Bot, calc: BotCalculationContext) {
        const isInContext3D = this.bots.has(file.id);
        const isInContext = isBotInContext(calc, file, this.context);

        if (!isInContext3D && isInContext) {
            this._addFile(file, calc);
        }
    }

    /**
     * Notifies this context that the given file was updated.
     * @param file The file.
     * @param updates The changes made to the file.
     * @param calc The calculation context that should be used.
     */
    botUpdated(
        file: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        const isInContext3D = this.bots.has(file.id);
        const isInContext = isBotInContext(calc, file, this.context);

        if (!isInContext3D && isInContext) {
            this._addFile(file, calc);
        } else if (isInContext3D && !isInContext) {
            this._removeFile(file.id, calc);
        } else if (isInContext3D && isInContext) {
            this._updateFile(file, updates, calc);
        }
    }

    /**
     * Notifies this context that the given file was removed from the state.
     * @param file The ID of the file that was removed.
     * @param calc The calculation context.
     */
    botRemoved(id: string, calc: BotCalculationContext) {
        this._removeFile(id, calc);
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this.bots) {
            this.bots.forEach(f => f.frameUpdate(calc));
        }
    }

    dispose(): void {
        if (this.bots) {
            this.bots.forEach(f => {
                f.dispose();
            });
        }
    }

    protected _addFile(file: Bot, calc: BotCalculationContext) {
        if (Context3D.debug) {
            console.log('[Context3D] Add', file.id, 'to context', this.context);
        }
        const mesh = new AuxFile3D(
            file,
            this.contextGroup,
            this.context,
            this.domain,
            this.colliders,
            this._decoratorFactory
        );
        this.bots.set(file.id, mesh);
        this.add(mesh);

        mesh.botUpdated(file, [], calc);

        // need to fire update twice as it sometimes doesn't update the file decorator the first time.
        mesh.botUpdated(file, [], calc);
    }

    protected _removeFile(id: string, calc: BotCalculationContext) {
        if (Context3D.debug) {
            console.log('[Context3D] Remove', id, 'from context', this.context);
        }
        const file = this.bots.get(id);
        if (typeof file !== 'undefined') {
            file.botRemoved(calc);
            file.dispose();
            this.remove(file);
            this.bots.delete(id);
        }
    }

    protected _updateFile(
        file: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        let mesh = this.bots.get(file.id);
        mesh.botUpdated(file, updates, calc);
    }
}
