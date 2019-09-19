import Component from 'vue-class-component';
import Vue from 'vue';
import { Prop } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class LoginPopup extends Vue {
    @Prop({ required: true }) show: boolean;

    close() {
        this.$emit('close');
    }
}
