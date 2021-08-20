import Component from 'vue-class-component';
import Vue from 'vue';
import { CameraRig } from '../../scene/CameraRigFactory';
import { Prop } from 'vue-property-decorator';
import { EventBus } from '@casual-simulation/aux-components';
import { IGameView } from '../../../shared/vue-components/IGameView';
import { Vector3 } from '@casual-simulation/three';
import { CameraRigControls } from '../../../shared/interaction/CameraRigControls';

@Component({})
export default class CameraHome extends Vue {
    @Prop({ default: true }) isVisible: boolean;

    onClick() {
        this.$emit('onCenterCamera');
    }

    beforeDestroy() {}
}
