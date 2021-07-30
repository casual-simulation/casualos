import Component from 'vue-class-component';
import Vue from 'vue';
import { hasValue } from '@casual-simulation/aux-common';
import { Prop } from 'vue-property-decorator';
import Tagline from '../Tagline/Tagline';

@Component({
    components: {
        tagline: Tagline,
    },
})
export default class Loading extends Vue {
    @Prop({ default: '' }) status: string;
    @Prop({ default: 0 }) progress: number;
    @Prop({ default: null }) error: string;
    @Prop({ default: false }) show: boolean;
    @Prop({}) version: string;

    showSpinner: boolean;

    get hasError(): boolean {
        return hasValue(this.error);
    }

    onErrorDismiss() {
        this.$emit('dismiss');
    }

    created() {
        const circleElement = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'circle'
        );
        this.showSpinner = circleElement instanceof SVGElement;
    }
}
