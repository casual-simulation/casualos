import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';

@Component({})
export default class SvgIcon extends Vue {
    @Prop({ required: true }) name: string;
    @Prop({ required: false }) width: number;
    @Prop({ required: false }) height: number;

    get symbolId() {
        return `#icon-${this.name}`;
    }
}
