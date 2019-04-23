import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop, Inject, Watch } from 'vue-property-decorator';
import { EventBus } from '../../shared/EventBus';

@Component({
    components: {},
})
export default class FileSearch extends Vue {
    isOpen: boolean = false;
    search: string = '';

    toggleOpen() {
        this.isOpen = !this.isOpen;
        EventBus.$emit('filesOpen', this.isOpen);
    }

    @Watch('search')
    onSearchChanged() {
        EventBus.$emit('searchChanged', this.search);
    }

    constructor() {
        super();
    }
}
