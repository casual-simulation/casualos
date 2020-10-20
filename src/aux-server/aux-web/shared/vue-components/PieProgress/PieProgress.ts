import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';

@Component({})
export default class PieProgress extends Vue {
    @Prop({ required: true }) progress: number;
    @Prop({ required: true }) color: string;
    @Prop({ required: true }) backgroundColor: string;

    // get fillStyle() {
    //     if (this.progress > 0.5) {
    //         return {
    //             transform: 'rotate(' + (this.progress - 0.5) +'turn)',
    //             'background-color': this.color
    //         };
    //     } else {
    //         return {
    //             transform: 'rotate(' + this.progress  +'turn)'
    //         };
    //     }
    // }

    constructor() {
        super();
    }
}
