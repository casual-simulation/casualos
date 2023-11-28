import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import { FormError } from '@casual-simulation/aux-records';

@Component({
    components: {},
})
export default class RegisterDialog extends Vue {
    @Prop({ required: true })
    field: string;

    @Prop({ required: true })
    errors: FormError[];

    get fieldErrors() {
        if (!this.errors) {
            return [];
        }
        return this.errors.filter((e) => e.for === this.field);
    }
}
