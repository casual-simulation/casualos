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
import { Input } from '../../scene/Input';
import { Vector2 } from '@casual-simulation/three';

@Component({
    components: {},
})
export default class TagValueEditorWrapper extends Vue {
    private _startMouseY: number;
    private _startHeight: number;

    finalHeight: number = 0;

    created() {
        this.finalHeight = 0;
    }

    mounted() {
        const element = this.$el as HTMLElement;
        element.onmousedown = this._mouseDown.bind(this);
        element.ondragstart = () => false;
    }

    private _mouseDown(event: MouseEvent) {
        const breadcrumbs = document.querySelector(
            '.editor-breadcrumbs'
        ) as HTMLElement;
        if (
            !Input.eventIsOverElement(
                new Vector2(event.clientX, event.clientY),
                breadcrumbs
            )
        ) {
            return;
        } else {
            event.preventDefault();
        }
        const rect = this.$el.getBoundingClientRect();
        this.finalHeight = this._startHeight = rect.height;
        this._startMouseY = event.pageY;

        const moveHandler = this._mouseMove.bind(this);
        document.addEventListener('mousemove', moveHandler);

        const upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };
        document.addEventListener('mouseup', upHandler);
    }

    private _mouseMove(event: MouseEvent) {
        const currentY = event.pageY;
        const delta = this._startMouseY - currentY;
        this.finalHeight = this._startHeight + delta;
    }
}
