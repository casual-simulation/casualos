import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    File,
    FileCalculationContext,
    calculateFormattedFileValue,
    calculateFileValue,
    isFormula,
} from '@casual-simulation/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { MenuItem } from '../MenuContext';

@Component({
    components: {},
})
export default class MenuFile extends Vue {
    @Prop() item: MenuItem;
    @Prop() index: number;
    @Prop({ default: false })
    selected: boolean;

    label: string = '';
    placeholder: string = '';
    input: string = '';
    inputValue: string = '';
    inputTarget: File = null;
    labelColor: string = '#000';
    backgroundColor: string = '#FFF';
    showDialog: boolean = false;

    @Watch('item')
    private async _fileChanged(item: MenuItem) {
        if (item) {
            const calc = item.simulation.simulation.helper.createContext();
            this._updateLabel(calc, item.file);
            this._updateColor(calc, item.file);
        } else {
            this.label = '';
            this.labelColor = '#000';
            this.backgroundColor = '#FFF';
        }
    }

    constructor() {
        super();
    }

    mounted() {
        this._fileChanged(this.item);
    }

    async click() {
        await this.item.simulation.simulation.helper.action('onClick', [
            this.item.file,
        ]);
        if (this.input) {
            const calc = this.item.simulation.simulation.helper.createContext();
            this.showDialog = true;
        }
    }

    async closeDialog() {
        if (this.showDialog) {
            await this.item.simulation.simulation.helper.action(
                'onCloseInput',
                [this.item.file]
            );
            this.showDialog = false;
        }
    }

    async saveDialog() {
        if (this.showDialog) {
            await this.item.simulation.simulation.helper.updateFile(
                this.inputTarget,
                {
                    tags: {
                        [this.input]: this.inputValue,
                    },
                }
            );
            await this.item.simulation.simulation.helper.action('onSaveInput', [
                this.item.file,
            ]);
            await this.closeDialog();
        }
    }

    private _updateColor(calc: FileCalculationContext, file: File) {
        if (file.tags['aux.color']) {
            this.backgroundColor = calculateFileValue(calc, file, 'aux.color');
        } else {
            this.backgroundColor = '#FFF';
        }
    }

    private _updateLabel(calc: FileCalculationContext, file: File) {
        let label = file.tags['aux.label'];
        if (label) {
            this.label = calculateFormattedFileValue(calc, file, 'aux.label');
            const labelColor = file.tags['aux.label.color'];
            if (labelColor) {
                this.labelColor = calculateFormattedFileValue(
                    calc,
                    file,
                    'aux.label.color'
                );
            } else {
                this.labelColor = '#000';
            }
        } else {
            this.label = '';
        }
    }
}
