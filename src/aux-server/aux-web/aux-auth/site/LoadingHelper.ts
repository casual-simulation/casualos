/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
export class LoadingHelper<T> {
    items: T[] = [];
    count: number = 0;

    private _currentRequest: Promise<TablePage<T>>;
    private _abortController: AbortController;
    private _makeRequest: (lastItem: T) => Promise<LoadedPage<T>>;

    constructor(makeRequest: (lastItem: T) => Promise<LoadedPage<T>>) {
        this._makeRequest = makeRequest;
        this._abortController = new AbortController();
    }

    /**
     * Cancels any in-flight requests and rejects pending promises.
     * Should be called when the component is switching to a different data source.
     */
    cancel(): void {
        this._abortController.abort();
        this._abortController = new AbortController();
        this._currentRequest = null;
        this.items = [];
        this.count = 0;
    }

    loadPage(page: number, pageSize: number): Promise<TablePage<T>> {
        if (!this._currentRequest) {
            this._currentRequest = this._loadPage(page, pageSize).then(
                (result) => {
                    this._currentRequest = null;
                    return result;
                },
                (error) => {
                    this._currentRequest = null;
                    throw error;
                }
            );
            return this._currentRequest;
        } else {
            this._currentRequest = this._currentRequest.then(() => {
                return this._loadPage(page, pageSize);
            });
            return this._currentRequest;
        }
    }

    private async _loadPage(
        page: number,
        pageSize: number
    ): Promise<TablePage<T>> {
        if (this._abortController.signal.aborted) {
            throw new Error('LoadingHelper has been cancelled');
        }

        let index = (page - 1) * pageSize;
        if (index >= this.items.length) {
            if (await this._loadMoreItems()) {
                const items = this.items.slice(index, index + pageSize);
                return {
                    mdCount: this.count,
                    mdPage: page,
                    mdData: items,
                    startIndex: index,
                    endIndex: index + items.length,
                };
            } else {
                return null;
            }
        }
        const items = this.items.slice(index, index + pageSize);
        return {
            mdCount: this.count,
            mdPage: page,
            mdData: items,
            startIndex: index,
            endIndex: index + items.length,
        };
    }

    private async _loadMoreItems(): Promise<boolean> {
        if (this._abortController.signal.aborted) {
            throw new Error('LoadingHelper has been cancelled');
        }

        try {
            const lastItem = this.items[this.items.length - 1];
            let results = await this._makeRequest(lastItem);

            if (this._abortController.signal.aborted) {
                throw new Error('LoadingHelper has been cancelled');
            }

            this.items = this.items.concat(results.items);
            this.count = results.totalCount;
            return results.items.length > 0;
        } catch (err) {
            if (this._abortController.signal.aborted) {
                throw new Error('LoadingHelper has been cancelled');
            }
            console.error(err);
            return false;
        }
    }
}

interface LoadedPage<T> {
    items: T[];
    totalCount: number;
}

interface TablePage<T> {
    mdData: T[];
    mdCount: number;
    mdPage: number;
    startIndex: number;
    endIndex: number;
}
