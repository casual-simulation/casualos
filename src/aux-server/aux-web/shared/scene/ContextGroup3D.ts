import { AuxFile } from "@yeti-cgi/aux-common/aux-format";
import { WorkspaceMesh } from "./WorkspaceMesh";
import { GameObject } from "./GameObject";
import { FileCalculationContext, TagUpdatedEvent, hasValue, calculateFileValue, AuxDomain, getContextPosition } from "@yeti-cgi/aux-common";
import { difference, flatMap } from "lodash";
import { Context3D } from "./Context3D";
import { GridChecker } from "./grid/GridChecker";
import { Object3D, Group } from "three";
import { AuxFile3DDecoratorFactory } from "./decorators/AuxFile3DDecoratorFactory";

/**
 * Defines a class that represents a visualization of a context for the AUX Builder.
 * 
 * Note that each aux file gets its own builder context.
 * Whether or not anything is visualized in the context depends on the file tags.
 */
export class ContextGroup3D extends GameObject {

    private _childColliders: Object3D[];

    /**
     * The file that this context represents.
     */
    file: AuxFile;

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

    private _decoratorFactory: AuxFile3DDecoratorFactory;

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
    constructor(file: AuxFile, domain: AuxDomain, decoratorFactory: AuxFile3DDecoratorFactory) {
        super();
        this.domain = domain;
        this.file = file;
        this.display = new Group();
        this.contexts = new Map();
        this._decoratorFactory = decoratorFactory;

        this.add(this.display);
    }

    /**
     * Gets the files that are contained by this builder context.
     */
    getFiles() {
        return flatMap([...this.contexts.values()], c => [...c.files.values()]);
    }

    frameUpdate(calc: FileCalculationContext) {
        this.contexts.forEach(context => {
            context.frameUpdate(calc);
        });
    }

    /**
     * Notifies the builder context that the given file was added to the state.
     * @param file The file that was added.
     * @param calc The file calculation context that should be used.
     */
    async fileAdded(file: AuxFile, calc: FileCalculationContext) {
        if (file.id === this.file.id) {
            this.file = file;
            await this._updateThis(file, [], calc);
            this._updateContexts(file, calc);
        }
        
        this.contexts.forEach(context => {
            context.fileAdded(file, calc);
        });
    }

    /**
     * Notifies the builder context that the given file was updated.
     * @param file The file that was updated.
     * @param updates The updates that happened on the file.
     * @param calc The file calculation context that should be used.
     */
    async fileUpdated(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        if (file.id === this.file.id) {
            this.file = file;
            await this._updateThis(file, updates, calc);
            this._updateContexts(file, calc);
        }
        
        this.contexts.forEach(context => {
            context.fileUpdated(file, updates, calc);
        });
    }

    /**
     * Notifies the builder context that the given file was removed from the state.
     * @param id The ID of the file that was removed.
     * @param calc The file calculation context that should be used.
     */
    fileRemoved(id: string, calc: FileCalculationContext) {
        this.contexts.forEach(context => {
            context.fileRemoved(id, calc);
        });
    }

    /**
     * Updates the contexts that this builder should be displaying.
     * @param old The old context file.
     * @param newFile The new context file.
     * @param calc The file calculation context that should be used.
     */
    private _updateContexts(file: AuxFile, calc: FileCalculationContext) {
        const contexts = calculateFileValue(calc, file, `${this.domain}.context`);
        // TODO: Handle scenarios where builder.context is empty or null
        if (contexts) {
            this._updateBuilderContext(file, contexts, calc);
        }
    }

    protected async _updateThis(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {}

    private _updateBuilderContext(file: AuxFile, newContexts: string | string[], calc: FileCalculationContext) {
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
            const newContexts = missingContexts.map(c => new Context3D(c, this, this.domain, this._childColliders, this._decoratorFactory));

            newContexts.forEach(c => {
                this.contexts.set(c.context, c);
                this.display.add(c);
            });
            removedContexts.forEach(c => {
                const context = this.contexts.get(c);
                if (typeof context !== 'undefined') {
                    this.contexts.delete(c);
                    this.display.remove(context);
                }
            });
        }
    }

    private currentContexts(): string[] {
        return [...this.contexts.keys()];
    }
}