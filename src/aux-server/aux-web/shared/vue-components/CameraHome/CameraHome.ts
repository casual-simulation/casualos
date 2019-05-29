import Component from 'vue-class-component';
import Vue from 'vue';
import { CameraRig } from '../../scene/CameraRigFactory';
import { Prop } from 'vue-property-decorator';
import { EventBus } from '../../../shared/EventBus';

@Component({})
export default class CameraHome extends Vue {
    /**
     * The camera rig that this home button is for.
     */
    @Prop() cameraRig: CameraRig;

    created() {}

    onClick() {
        EventBus.$emit('centerCamera', this.cameraRig);
    }

    beforeDestroy() {}
}
