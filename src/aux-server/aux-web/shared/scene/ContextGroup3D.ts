import { AuxFile } from "@yeti-cgi/aux-common/aux-format";
import { WorkspaceMesh } from "./WorkspaceMesh";
import { GameObject } from "./GameObject";
import { FileCalculationContext, TagUpdatedEvent, hasValue, calculateFileValue, AuxDomain, getContextPosition } from "@yeti-cgi/aux-common";
import { difference, flatMap } from "lodash";
import { Context3D } from "./Context3D";
import { GridChecker } from "./grid/GridChecker";
import { Object3D, Group } from "three";

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
     * The workspace that this context contains.
     */
    surface: WorkspaceMesh;

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

    // TODO: Move this to a builder specific class
    private _checker: GridChecker;

    get colliders() {
        if (this.surface) {
            return flatMap([this._childColliders, this.surface.colliders]);
        } else {
            return this._childColliders;
        }
    }

    set colliders(value: Object3D[]) {
        this._childColliders = value;
    }

    setGridChecker(gridChecker: GridChecker) {
        this._checker = gridChecker;
    }

    /**
     * Creates a new Builder Context 3D Object.
     * @param The file that this builder represents.
     */
    constructor(file: AuxFile) {
        super();
        this.domain = 'builder';
        this.file = file;
        this.display = new Group();
        this.contexts = new Map();

        this.add(this.display);
    }

    /**
     * Gets the files that are contained by this builder context.
     */
    getFiles() {
        return flatMap([...this.contexts.values()], c => [...c.files.values()]);
    }

    frameUpdate() {
        this.contexts.forEach(context => {
            context.frameUpdate();
        });
    }

    /**
     * Notifies the builder context that the given file was added to the state.
     * @param file The file that was added.
     * @param calc The file calculation context that should be used.
     */
    fileAdded(file: AuxFile, calc: FileCalculationContext) {
        if (file.id === this.file.id) {
            this.file = file;
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
            this._updateContexts(file, calc);
            await this._updateWorkspace(file, updates, calc);
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

    /**
     * Updates this builder's workspace.
     * @param file 
     * @param updates 
     * @param calc 
     */
    private async _updateWorkspace(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        // TODO: Get this to update with the builder.context
        if (file.tags[`${this.domain}.context`]) {
            if (!this.surface) {
                this.surface = new WorkspaceMesh(this.domain);
                this.surface.gridGhecker = this._checker;
                this.add(this.surface);
            }
            
            await this.surface.update(calc, file);
            const position = getContextPosition(calc, this.file, this.domain);

            this.display.visible = this.surface.container.visible;
            this.position.x = position.x;
            this.position.y = position.z;
            this.position.z = position.y;
        }
    }

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
            const newContexts = missingContexts.map(c => new Context3D(c, this, this.domain, this._childColliders));

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