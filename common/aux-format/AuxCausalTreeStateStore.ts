import { StateStore, Event } from "common/channels-core";
import { AuxCausalTree } from "./AuxCausalTree";

/**
 * Defines a state store that is able to pipe events into a AuxCausalTree.
 */
export class AuxCausalTreeStateStore<T> implements StateStore<AuxCausalTree> {

    private _tree: AuxCausalTree;
    private _site: number;

    constructor(site: number) {
        this._site = site;
    }

    process(event: Event): void {
        throw new Error("Method not implemented.");
    }
    
    init(state?: AuxCausalTree): void {
        if (state) {
            this._tree = state;
        } else {
            this._tree = new AuxCausalTree(this._site);
        }
    }
    
    state(): AuxCausalTree {
        throw new Error("Method not implemented.");
    }


}