import Component from 'vue-class-component';
import Vue from 'vue';
import { LoadingProgress } from '@casual-simulation/aux-common/LoadingProgress';
import { appManager } from '../../../shared/AppManager';
import { hasValue } from '@casual-simulation/aux-common';
import { Prop } from 'vue-property-decorator';

@Component({})
export default class Loading extends Vue {
    @Prop({ default: '' }) status: string;
    @Prop({ default: 0 }) progress: number;
    @Prop({ default: null }) error: string;
    @Prop({ default: false }) show: boolean;

    get hasError(): boolean {
        return hasValue(this.error);
    }

    onErrorDismiss() {
        this.$emit('dismiss');
    }
}
