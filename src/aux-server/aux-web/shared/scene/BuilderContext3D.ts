import { AuxFile } from "@yeti-cgi/aux-common/aux-format";
import { WorkspaceMesh } from "./WorkspaceMesh";
import { FileMesh } from "./FileMesh";
import { GameObject } from "./GameObject";
import { FileCalculationContext, TagUpdatedEvent, hasValue, calculateFileValue } from "@yeti-cgi/aux-common";
import { difference } from "lodash";
import { Context3D } from "./Context3D";

/**
 * Defines a class that represents a visualization of a context for the AUX Builder.
 * 
 * Note that each aux file gets its own builder context.
 * Whether or not anything is visualized in the context depends on the file tags.
 */
export class BuilderContext3D extends GameObject {

    /**
     * The file that this context represents.
     */
    file: AuxFile;

    /**
     * The workspace that this context contains.
     */
    surface: WorkspaceMesh;

    /**
     * The contexts that are represented by this builder context.
     */
    contexts: Map<string, Context3D>;

    /**
     * Creates a new Builder Context 3D Object.
     * @param The file that this builder represents.
     */
    constructor(file: AuxFile) {
        super();
        this.file = file;
        this.contexts = new Map();
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
    fileUpdated(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        if (file.id === this.file.id) {
            this.file = file;
            this._updateContexts(file, updates, calc);
            this._updateWorkspace(file, updates, calc);
        }
        
        this.contexts.forEach(context => {
            context.fileUpdated(file, updates, calc);
        });
    }

    /**
     * Notifies the builder context that the given file was removed from the state.
     * @param file The file that was removed.
     * @param calc The file calculation context that should be used.
     */
    fileRemoved(file: AuxFile, calc: FileCalculationContext) {
        this.contexts.forEach(context => {
            context.fileRemoved(file, calc);
        });
    }

    /**
     * Updates the contexts that this builder should be displaying.
     * @param old The old context file.
     * @param newFile The new context file.
     * @param calc The file calculation context that should be used.
     */
    private _updateContexts(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        updates.forEach(update => {
            if (update.tag === 'builder.context') {
                this._updateBuilderContext(file, update, calc);
            }
        });
    }

    /**
     * Updates this builder's workspace.
     * @param file 
     * @param updates 
     * @param calc 
     */
    private _updateWorkspace(file: AuxFile, updates: TagUpdatedEvent[], calc: FileCalculationContext) {
        if (!this.surface) {
            this.surface = new WorkspaceMesh();
        }

        this.surface.update(file);
    }

    private _updateBuilderContext(file: AuxFile, update: TagUpdatedEvent, calc: FileCalculationContext) {
        let contexts: string[];
        if (Array.isArray(update.calculatedValue)) {
            contexts = update.calculatedValue;
        } else if (typeof update.calculatedValue === 'string') {
            contexts = [update.calculatedValue];
        }

        if (contexts) {
            const currentContexts = this.currentContexts();
            const missingContexts = difference(contexts, currentContexts);
            const removedContexts = difference(currentContexts, contexts);
            const newContexts = missingContexts.map(c => new Context3D(c, this.colliders));

            newContexts.forEach(c => {
                this.contexts.set(c.context, c);
                // TODO: Add to visual tree
            });
            removedContexts.forEach(c => {
                this.contexts.delete(c);
                // TODO: Remove from visual tree
            });
        }
    }

    private currentContexts(): string[] {
        return [...this.contexts.keys()];
    }

}