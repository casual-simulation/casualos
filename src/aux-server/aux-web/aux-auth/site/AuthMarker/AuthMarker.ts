import { EventBus } from '@casual-simulation/aux-components';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch, Prop } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { SvgIcon } from '@casual-simulation/aux-components';

@Component({
    components: {
        'svg-icon': SvgIcon,
    },
})
export default class AuthMarker extends Vue {
    @Prop({ required: true })
    marker: string;

    onClick() {
        this.$emit('click', this.marker);
    }
}
