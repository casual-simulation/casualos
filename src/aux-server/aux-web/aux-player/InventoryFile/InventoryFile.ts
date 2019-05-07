import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import { Object, AuxFile } from '@casual-simulation/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { appManager } from '../../shared/AppManager';
import { InventoryItem } from '../InventoryContext';

@Component({
    components: {},
})
export default class InventoryFile extends Vue {
    @Prop() item: InventoryItem;
    @Prop() slotIndex: number;
    @Prop({ default: false })
    selected: boolean;

    image: string = '';
    label: string = '';
    labelColor: string = '#000';
    showImage: string = 'flex';

    @Inject() fileRenderer: FileRenderer;

    get file(): AuxFile {
        return this.item ? this.item.file : null;
    }

    @Watch('file')
    private async _fileChanged(file: AuxFile) {
        if (file) {
            this.image = await this.fileRenderer.render(
                file,
                this.item.simulation.simulation.helper.createContext()
            );
            this.showImage = 'flex';
            let label = file.tags['aux.label'];
            if (label) {
                this.label = this.item.simulation.simulation.helper.calculateFormattedFileValue(
                    file,
                    'aux.label'
                );

                const labelColor = file.tags['aux.label.color'];
                if (labelColor) {
                    this.labelColor = this.item.simulation.simulation.helper.calculateFormattedFileValue(
                        file,
                        'aux.label.color'
                    );
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
            this.showImage = 'none';
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
}
