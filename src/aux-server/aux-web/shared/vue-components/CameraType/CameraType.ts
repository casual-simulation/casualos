import Component from 'vue-class-component';
import Vue from 'vue';
import { CameraRig } from '../../scene/CameraRigFactory';
import { Prop } from 'vue-property-decorator';
import { EventBus } from '../../../shared/EventBus';
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
