import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch, Prop } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class PrivacyItem extends Vue {
    @Prop({ required: true })
    value: boolean;

    get tooltip() {
        return this.value ? 'Allowed' : 'Denied';
    }
}
