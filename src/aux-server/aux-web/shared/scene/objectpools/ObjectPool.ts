import { getOptionalValue } from '../../SharedUtils';
import { v4 as uuid } from 'uuid';
import { remove } from 'lodash';

/**
 * This is a generic object pool class that can be extended from to implement a pool for
 * theoretically any type of object you would want.
 */
export abstract class ObjectPool<T> {
    name: string;

    /**
     * Log a warning to the console when the pool empty, causing a new object to be generated during retrieve.
     */
    poolEmptyWarn: boolean;

    private _pool: T[];

    /**
     * Simple map of objects that this pool is responsible for and has created.
     * Used mostly to check that an object being placed back in the pool actually does belong here.
     */
    private _objectIds: Map<string, boolean>;

    get poolSize(): number {
        return this._pool.length;
    }

    constructor(name?: string, poolEmptyWarn?: boolean) {
        this.name = getOptionalValue(name, `ObjectPool_${uuid()}`);
        this.poolEmptyWarn = getOptionalValue(poolEmptyWarn, true);
        this._objectIds = new Map<string, boolean>();
    }

    /**
     * Initialize the pool of objects.
     * @param startSize [Optional] How starting size of the object pool (Default is 5).
     */
    initializePool(startSize?: number): this {
        if (this._pool) return;

        startSize = startSize || 5;

        this._pool = [];

        for (let i = 0; i < startSize; i++) {
            const obj = this.createPoolObject();
            const id = this.getPoolObjectId(obj);
            this._objectIds.set(id, true);

            this._pool.push(obj);
        }

        return this;
    }

    /**
     * Retrieve an object from the pool.
     */
    retrieve(): T {
        if (!this._pool) {
            this.initializePool();
        }

        let obj: T = null;

        if (this._pool.length > 0) {
            obj = this._pool[0];
            remove(this._pool, (o) => o === obj);
        } else {
            if (this.poolEmptyWarn) {
                console.warn(
                    '[ObjectPool]',
                    this.name,
                    'ran out of objects in its pool, so it is generating another one.'
                );
            }
            obj = this.createPoolObject();
            const id = this.getPoolObjectId(obj);
            this._objectIds.set(id, true);
        }

        this.onRetrieved(obj);

        return obj;
    }

    /**
     * Restore the object to the pool.
     * @param obj
     */
    restore(obj: T): boolean {
        if (!this._pool) {
            console.warn(
                "[ObjectPool] Can't place object",
                obj,
                'in pool',
                this.name,
                'because the pool was never initialized.'
            );
            return false;
        }

        const id = this.getPoolObjectId(obj);
        if (!this._objectIds.has(id)) {
            console.warn(
                "[ObjectPool] Can't place object",
                obj,
                'in pool',
                this.name,
                'because it does not originate from it.'
            );
            return false;
        }

        this._pool.push(obj);
        this.onRestored(obj);

        return true;
    }

    /**
     * Dispose of the pool and any objects it is holding on to.
     */
    dispose(): void {
        if (this._pool) {
            for (let i = this._pool.length - 1; i >= 0; i--) {
                let obj = this._pool[i];
                if (obj) {
                    this.disposePoolObject(obj);
                }

                this._pool.splice(i, 1);
            }
        }

        this._objectIds.clear();
    }

    /**
     * Called when an object is retrieved from the pool.
     * @param obj The object that was retrieved.
     */
    abstract onRetrieved(obj: T): void;

    /**
     * Called when an object is restored to the pool.
     * @param obj The object that was restored.
     */
    abstract onRestored(obj: T): void;

    /**
     * Called to create a new object for the pool.
     */
    abstract createPoolObject(): T;

    /**
     * Called to retireve an unique id for the given object.
     * @param obj The object to get an id for.
     */
    abstract getPoolObjectId(obj: T): string;

    /**
     * Called when the object is being disposed of.
     * @param obj The object being disposed.
     */
    abstract disposePoolObject(obj: T): void;
}
