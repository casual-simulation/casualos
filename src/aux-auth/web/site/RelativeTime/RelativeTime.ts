import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { DateTime } from 'luxon';

@Component({
    components: {},
})
export default class RelativeTime extends Vue {
    @Prop({ required: false }) millis: number;
    @Prop({ required: false }) seconds: number;

    get relativeTime() {
        const time = this.millis
            ? DateTime.fromMillis(this.millis)
            : DateTime.fromSeconds(this.seconds);
        return time.toRelative();
    }

    get commonTime() {
        const time = this.millis
            ? DateTime.fromMillis(this.millis)
            : DateTime.fromSeconds(this.seconds);
        return time.toLocaleString(DateTime.DATETIME_FULL);
    }
}
