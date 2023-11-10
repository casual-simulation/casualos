import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class HasAccountDialog extends Vue {
    processing: boolean = false;
    hasAccountValue: boolean = null;

    hasAccount(hasAccount: boolean) {
        this.processing = true;
        this.hasAccountValue = hasAccount;
        this.$emit('hasAccount', hasAccount);
    }
}
