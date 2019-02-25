import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide, Prop, Inject, Watch} from 'vue-property-decorator';
import {File, Object} from '@yeti-cgi/aux-common';

@Component({
    components: {
    },
    
})
export default class FileTableToggle extends Vue {
    
    @Prop() files: Object[];
    @Prop({ default: false }) raised: boolean;
    numFilesSelected: number = 0;

    @Watch('files')
    filesChanged() {
        this.numFilesSelected = this.files.length;
    }

    click() {
        this.$emit('click');
    }

    constructor() {
        super();
    }

    async created() {
        this.numFilesSelected = this.files.length;
    }
};