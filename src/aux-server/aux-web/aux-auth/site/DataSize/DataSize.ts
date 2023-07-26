import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';

@Component({
    components: {},
})
export default class DataSize extends Vue {
    @Prop({ required: true })
    sizeInBytes: number;

    get sizeInKiloBytes() {
        return this.sizeInBytes / 1000;
    }

    get sizeInMegaBytes() {
        return this.sizeInBytes / 1000000;
    }

    get sizeInGigaBytes() {
        return this.sizeInBytes / 1000000000;
    }

    get humanSize() {
        if (this.sizeInGigaBytes > 0.5) {
            return `${this.sizeInGigaBytes.toFixed(2)} GB`;
        } else if (this.sizeInMegaBytes > 0.5) {
            return `${this.sizeInMegaBytes.toFixed(2)} MB`;
        } else if (this.sizeInKiloBytes > 5) {
            return `${this.sizeInKiloBytes.toFixed(2)} KB`;
        } else {
            return `${this.sizeInBytes} Bytes`;
        }
    }
}
