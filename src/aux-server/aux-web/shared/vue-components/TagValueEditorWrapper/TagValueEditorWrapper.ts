import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
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
