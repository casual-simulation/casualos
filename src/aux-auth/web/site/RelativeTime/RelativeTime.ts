import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { DateTime } from 'luxon';

@Component({
    components: {},
})
export default class RelativeTime extends Vue {
    @Prop() millis: number;

    get relativeTime() {
        const time = DateTime.fromMillis(this.millis);
        return time.toRelative();
    }

    get commonTime() {
        const time = DateTime.fromMillis(this.millis);
        return time.toLocaleString(DateTime.DATETIME_FULL);
    }
}
