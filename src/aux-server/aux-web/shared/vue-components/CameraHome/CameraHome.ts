import Component from 'vue-class-component';
import Vue from 'vue';
import { CameraRig } from '../../scene/CameraRigFactory';
import { Prop } from 'vue-property-decorator';
import { EventBus } from '../../../shared/EventBus';
import { IGameView } from '../../../shared/vue-components/IGameView';
import { Vector3 } from 'three';
import { CameraRigControls } from '../../../shared/interaction/CameraRigControls';

@Component({})
export default class CameraHome extends Vue {
    /**
     * The camera rig that this home button is for.
     */
    @Prop() cameraRig: CameraRig;

    /**
     * The distance the camera target needs to be away from the origin in order for the button to be shown.
     */
    @Prop({ default: 75 }) showDistance: number;

    isVisible: boolean = true;

    private gameView: IGameView;
    private rigControls: CameraRigControls;

    created() {
        this.gameView = <IGameView>this.$parent;
        this.update();
    }

    onClick() {
        EventBus.$emit('centerCamera', this.cameraRig);
    }

    update(): void {
        if (this.cameraRig) {
            if (!this.rigControls || this.rigControls.rig !== this.cameraRig) {
                this.rigControls = this.gameView.game
                    .getInteraction()
                    .cameraRigControllers.find(
                        rigControls => rigControls.rig === this.cameraRig
                    );
            }

            if (this.rigControls) {
                if (this.showDistance > 0) {
                    const target = this.rigControls.controls.target.clone();
                    const distSqr = target.distanceToSquared(
                        new Vector3(0, 0, 0)
                    );

                    this.isVisible = distSqr >= this.showDistance;
                } else {
                    // Always show the button.
                    this.isVisible = true;
                }
            } else {
                this.isVisible = false;
            }
        } else {
            this.isVisible = false;
        }

        requestAnimationFrame(() => this.update());
    }

    beforeDestroy() {}
}
