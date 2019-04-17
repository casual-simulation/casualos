import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import { Object, AuxFile } from '@casual-simulation/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { appManager } from '../../shared/AppManager';

@Component({
    components: {
    },
})
export default class InventoryFile extends Vue {

    @Prop() file: AuxFile;
    @Prop() slotIndex: number;
    @Prop({ default: false }) selected: boolean;
    @Prop() context: string;

    image: string = '';
    label: string = '';
    labelColor: string = '#000';

    @Inject() fileRenderer: FileRenderer;

    @Watch('file')
    private async _fileChanged(file: AuxFile) {
        if (file) {
            this.image = await this.fileRenderer.render(file);
            let label = file.tags['aux.label'];
            if (label) {
                this.label = appManager.fileManager.calculateFormattedFileValue(file, 'aux.label');
    
                const labelColor = file.tags['aux.label.color'];
                if (labelColor) {
                    this.labelColor = appManager.fileManager.calculateFormattedFileValue(file, 'aux.label.color');
    
                } else {
                    this.labelColor = '#000';
                }
            } else {
                this.label = '';
            }
        } else {
            this.image = '';
            this.label = '';
            this.labelColor = '#000';
        }
    }

    constructor() {
        super();
        this.image = '';
    }

    mounted() {
        this._fileChanged(this.file);
    }

    click() {
        this.$emit('click');
    }
};