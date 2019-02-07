import Vue from 'vue';
import { Compact } from 'vue-color';
import Component from "vue-class-component";
import { ColorPickerEvent } from '../interaction/ColorPickerEvent';
import { EventBus } from '../EventBus/EventBus';

@Component({
    components: {
        'compact-color-picker': Compact
    }
})
export default class ColorPicker extends Vue {

    colorPickerStyle: any = {
        left: '0px',
        top: '0px'
    }

    colorPickerEvent: ColorPickerEvent = null;
    colorPickerVisible: boolean = false;
    colors: string = "#FF0000";
    
    constructor() {
        super();
    }
    
    async mounted() {

        this.open = this.open.bind(this);
        this._handleMouseDown = this._handleMouseDown.bind(this);

        EventBus.$on('onColorPicker', this.open);

    }

    beforeDestroy() {

        EventBus.$off('onColorPicker', this.open);

    }
    
    /**
     * Open the color picker.
     */
    open(event: ColorPickerEvent) {

        if (!event) return;

        // Force the component to disable current color picker.
        this.close();

        // Wait for the DOM to update with the above values and then show color picker again.
        this.$nextTick(() => {
            this.colorPickerEvent = event;

            // Starting value of the color picker is determined by the provided color in the event.
            this.colors = this.colorPickerEvent.initialColor;

            this.colorPickerStyle.left = event.pagePos.x + 'px';
            this.colorPickerStyle.top = event.pagePos.y + 'px';
            this.colorPickerVisible = true;

            // Listen for clicks on the DOM.
            document.addEventListener('mousedown', this._handleMouseDown);
            document.addEventListener('touchstart', this._handleTouchStart);

            // Wait another frame so that the component has time to turn on and we can get the rect sizes.
            this.$nextTick(() => {
                
                // Lets make sure we are constrainted inside our parent rect.
                let parentRect = <DOMRect>this.$el.parentElement.getBoundingClientRect();
                let rect = <DOMRect>this.$el.getBoundingClientRect();

                if (rect.x + rect.width > parentRect.width) {
                    // Move the x position so that the elements entire width fits inside the parent rect.
                    let x = rect.x - ((rect.x + rect.width) - parentRect.width);
                    this.colorPickerStyle.left = x + 'px';
                }

                if (rect.y + rect.height > parentRect.height) {
                    // Move the y position so that the elements entire height fits inside the parent rect.
                    let y = rect.y - ((rect.y + rect.height) - parentRect.height);
                    this.colorPickerStyle.top = y + 'px';
                }
            });
        });

    }

    /**
     * Close the color picker.
     */
    close() {

        this.colorPickerVisible = false;
        this.colorPickerEvent = null;

        // Stop listening for clicks on the DOM.
        document.removeEventListener('mousedown', this._handleMouseDown);
        document.removeEventListener('touchstart', this._handleTouchStart);

    }

    onColorPickerInput() {

        if (!this.colorPickerEvent) return;

        let hexColor = (<any>this.colors).hex;
        this.colorPickerEvent.colorUpdated(hexColor);

    }

    private _handleMouseDown(event: MouseEvent) {

        if (event.target instanceof Element) {
            if (!this.$el.contains(event.target)){
                this.close();
            }
        }

    }

    private _handleTouchStart(event: TouchEvent) {
        
        if (event.target instanceof Element) {
            if (!this.$el.contains(event.target)) {
                this.close();
            }
        }
    }

}