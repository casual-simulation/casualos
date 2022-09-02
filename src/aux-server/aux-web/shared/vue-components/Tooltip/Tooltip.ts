import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class Tooltips extends Vue {
    @Prop({}) message: string;
    @Prop({}) hidden: boolean;
    @Prop({}) position: any;

    constructor() {
        super();
    }

    @Watch('style')
    onStyleUpdated() {
        this._adjustPosition();
    }

    mounted() {
        this._adjustPosition();
    }

    private _adjustPosition() {
        const screenPadding = 16;

        const el = this.$el as HTMLElement;
        const text = this.$refs.text as HTMLElement;
        const containerRect = el.getBoundingClientRect();
        const textRect = text.getBoundingClientRect();

        const containerRightX = containerRect.x + containerRect.width;
        const containerBottomY = containerRect.y + containerRect.height;
        const textRightX = textRect.x + textRect.width;
        const textBottomY = textRect.y + textRect.height;

        let translateX = '-50%';
        let translateY = '-50%';
        if (textRect.x < 0) {
            text.style.left = '0';
            text.style.right = 'auto';
            translateX = `${-containerRect.x + screenPadding}px`;
        } else if (textRightX > window.innerWidth) {
            text.style.right = '0';
            text.style.left = 'auto';
            translateX = `${
                window.innerWidth - containerRightX - screenPadding
            }px`;
        } else {
            text.style.left = '50%';
            text.style.right = 'auto';
        }

        if (textRect.y < 0) {
            text.style.top = '0';
            text.style.bottom = 'auto';
            translateY = `${-containerRect.y + screenPadding}px`;
        } else if (textBottomY > window.innerHeight) {
            text.style.top = 'auto';
            text.style.bottom = '0';
            translateY = `${
                window.innerHeight - containerBottomY - screenPadding
            }px`;
        } else {
            text.style.top = '50%';
            text.style.bottom = 'auto';
        }

        text.style.transform = `translate(${translateX}, ${translateY})`;
    }
}
