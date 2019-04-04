import { Object3D } from "three";
import {  } from 'lodash';
import { getOptionalValue } from "../SharedUtils";
import uuid from 'uuid/v4';
import { disposeObject3D } from "./SceneUtils";
import { remove } from 'lodash';

export class Object3DPool {

    name: string;

    /**
     * Log a warning to the console when the pool empty, causing a new object to be generated during retrieve.
     */
    poolEmptyWarn: boolean;

    private _pool: Object3D[];
    private _sourceObject: Object3D;

    /**
     * Simple map of objects that this pool is responsible for and has created.
     * Used mostly to check that an object being placed back in the pool actually does belong here.
     */
    private _objectIds: Map<string, boolean>;

    get poolSize(): number { return this._pool.length; }
    
    constructor(sourceObject: Object3D, startSize: number, name?: string, poolEmptyWarn?: boolean) {
        this.name = getOptionalValue(name, `Object3DPool_${uuid()}`);
        this.poolEmptyWarn = getOptionalValue(poolEmptyWarn, true);
        this._sourceObject = sourceObject.clone(true);
        this._sourceObject.visible = false;
        this._sourceObject.parent = null;
        this._pool = [];
        this._objectIds = new Map<string, boolean>();
        this._objectIds.set(this._sourceObject.uuid, true);

        for (let i = 0; i < startSize; i++) {
            let obj3d = this._sourceObject.clone(true);
            obj3d.visible = false;
            this._objectIds.set(obj3d.uuid, true);

            this._pool.push(obj3d);
        }
    }

    /**
     * Retireve an object from the pool.
     */
    retrieve(): Object3D {
        let obj3d: Object3D = null;

        if (this._pool.length > 0) {
            // obj3d = this._pool.splice(this._pool.length - 1, 1)[0];
            obj3d = this._pool[0];
            remove(this._pool, (o) =>  o === obj3d );
        } else {
            if (this.poolEmptyWarn) {
                console.warn('[Object3DPool]', this.name, 'ran out of objects in its pool, so it is generating another one.');
            }
            obj3d = this._sourceObject.clone(true);
            this._objectIds.set(obj3d.uuid, true);
        }

        obj3d.visible = true;
        return obj3d;
    }

    /**
     * Restore the object to the pool.
     * @param obj3d 
     */
    restore(obj3d: Object3D): boolean {
        if (!this._objectIds.has(obj3d.uuid)) {
            console.warn('[Object3DPool] Can\'t place object', obj3d, 'in pool', this.name, 'because it does not originate from it.');
            return false;
        }

        obj3d.visible = false;
        obj3d.parent = null;
        this._pool.push(obj3d);
        return true;
    }

    /**
     * Dispose of the pool and any objects it is holding on to.
     */
    dispose(): void {
        for (let i = this._pool.length - 1; i >= 0; i--) {
            let obj3d = this._pool[i];
            if (obj3d) {
                disposeObject3D(obj3d, true, true);
            }

            this._pool.splice(i, 1);
        }

        this._objectIds.clear();
    }
}