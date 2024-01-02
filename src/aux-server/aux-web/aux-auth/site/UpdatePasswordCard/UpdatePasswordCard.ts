import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class UpdatePasswordCard extends Vue {
    @Prop() updatePasswordUrl: string;
    @Prop() requireParentEmail: boolean;

    get checkEmailText() {
        if (this.requireParentEmail) {
            return `Tell your parent to check their email for a message from Privo. If you don't see it, check your spam folder.`;
        } else {
            return `Check your email for a message from Privo. If you don't see it, check your spam folder.`;
        }
    }

    close() {
        this.$emit('close');
    }
}
