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
import Component from 'vue-class-component';
import Vue from 'vue';
import type { CameraRig } from '../../scene/CameraRigFactory';
import { Prop } from 'vue-property-decorator';
import { EventBus } from '@casual-simulation/aux-components';
import { PerspectiveCamera } from '@casual-simulation/three';

@Component({})
export default class CameraType extends Vue {
    /**
     * The camera rig that this button is for.
     */
    // TODO: Update to not require a reference to a camera rig
    @Prop() cameraRig: CameraRig;

    get isPerspective(): boolean {
        if (!this.cameraRig) return undefined;
        return this.cameraRig.mainCamera instanceof PerspectiveCamera;
    }

    created() {}

    toggle() {
        if (this.isPerspective) {
            EventBus.$emit('changeCameraType', 'orthographic');
        } else {
            EventBus.$emit('changeCameraType', 'perspective');
        }
    }

    beforeDestroy() {}
}
