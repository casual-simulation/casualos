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
import Vue from 'vue';
import Component from 'vue-class-component';
import type { ShoutAction, Bot } from '@casual-simulation/aux-common';
import { ON_FILE_UPLOAD_ACTION_NAME } from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import type { SubscriptionLike } from 'rxjs';
import { Subscription } from 'rxjs';
import { Input } from '../../scene/Input';
import { getFileData } from '../../DownloadHelpers';

@Component({
    components: {},
})
export default class UploadFiles extends Vue {
    showUploadFiles: boolean = false;

    private _counter: number = 0;
    private _subscriptions: SubscriptionLike[];

    created() {
        this._subscriptions = [];
        this._counter = 0;
    }

    mounted() {
        const dragEnterListener = (event: DragEvent) => this.onDragEnter(event);
        const dragLeaveListener = (event: DragEvent) => this.onDragLeave(event);
        const dragOverListener = (event: DragEvent) => this.onDragOver(event);
        const dropListener = (event: DragEvent) => this.onDrop(event);

        document.addEventListener('dragenter', dragEnterListener, false);
        document.addEventListener('dragleave', dragLeaveListener, false);
        document.addEventListener('dragover', dragOverListener, false);
        document.addEventListener('drop', dropListener, false);

        this._subscriptions.push(
            new Subscription(() => {
                document.removeEventListener('dragenter', dragEnterListener);
                document.removeEventListener('dragleave', dragLeaveListener);
                document.removeEventListener('dragover', dragOverListener);
                document.removeEventListener('drop', dropListener);
            })
        );
    }

    beforeDestroy() {
        for (let sub of this._subscriptions) {
            sub.unsubscribe();
        }
    }

    onDragEnter(event: DragEvent) {
        if (this._counter < 0) {
            this._counter = 0;
        }
        if (
            Input.isElementContainedByOrEqual(
                <Element>event.target,
                this.$parent.$el as HTMLElement
            )
        ) {
            if (event.dataTransfer.types.indexOf('Files') >= 0) {
                this.showUploadFiles = true;
                event.dataTransfer.dropEffect = 'copy';
                event.preventDefault();
                this._counter += 1;
            }
        }
    }

    onDragOver(event: DragEvent) {
        if (
            Input.isElementContainedByOrEqual(
                <Element>event.target,
                this.$parent.$el as HTMLElement
            )
        ) {
            if (event.dataTransfer.types.indexOf('Files') >= 0) {
                this.showUploadFiles = true;
                event.dataTransfer.dropEffect = 'copy';
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }

    onDragLeave(event: DragEvent) {
        if (
            Input.isElementContainedByOrEqual(
                <Element>event.target,
                this.$parent.$el as HTMLElement
            )
        ) {
            this._counter -= 1;
        }

        if (this._counter <= 0) {
            this.showUploadFiles = false;
        }
    }

    async onDrop(event: DragEvent) {
        this.showUploadFiles = false;
        this._counter = 0;

        if (
            Input.isElementContainedByOrEqual(
                <Element>event.target,
                this.$parent.$el as HTMLElement
            )
        ) {
            event.preventDefault();

            let files: File[] = [];
            if (event.dataTransfer.items) {
                for (let i = 0; i < event.dataTransfer.items.length; i++) {
                    const item = event.dataTransfer.items[i];
                    if (item.kind === 'file') {
                        const file = item.getAsFile();
                        files.push(file);
                    }
                }
            } else {
                for (let i = 0; i < event.dataTransfer.files.length; i++) {
                    const file = event.dataTransfer.files.item(i);
                    files.push(file);
                }
            }

            if (files.length > 0) {
                const finalFiles = await Promise.all(
                    files.map(async (f) => {
                        const data = await getFileData(f);
                        return {
                            name: f.name,
                            size: f.size,
                            data: data,
                            mimeType: f.type,
                        };
                    })
                );

                for (let sim of appManager.simulationManager.simulations.values()) {
                    let actions: ShoutAction[] = sim.helper.actions(
                        finalFiles.map((f) => ({
                            bots: null as Bot[],
                            eventName: ON_FILE_UPLOAD_ACTION_NAME,
                            arg: {
                                file: f,
                            },
                        }))
                    );

                    sim.helper.transaction(...actions);
                }
            }
        }
    }
}
