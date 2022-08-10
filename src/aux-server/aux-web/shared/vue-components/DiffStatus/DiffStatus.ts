import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Provide, Prop } from 'vue-property-decorator';

@Component({
    components: {},
})
export default class DiffStatus extends Vue {
    @Prop({ required: true })
    status: 'added' | 'removed' | 'changed' | 'none';
}
