import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class UpdatePasswordDialog extends Vue {
    @Prop() updatePasswordUrl: string;
    close() {
        this.$emit('close');
    }
}
