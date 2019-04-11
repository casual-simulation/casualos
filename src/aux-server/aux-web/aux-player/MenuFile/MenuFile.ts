import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import { File, AuxFile, FileCalculationContext, getFileInputTarget, calculateFormattedFileValue, calculateFileValue, isFormula, getFileInputPlaceholder } from '@yeti-cgi/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { appManager } from '../../shared/AppManager';

@Component({
    components: {
    },
})
export default class MenuFile extends Vue {

    @Prop() file: AuxFile;
    @Prop() index: number;
    @Prop({ default: false }) selected: boolean;
    @Prop() context: string;

    label: string = '';
    placeholder: string = '';
    input: string = '';
    inputValue: string = '';
    inputTarget: AuxFile = null;
    labelColor: string = '#000';
    backgroundColor: string = '#FFF';
    showDialog: boolean = false;

    @Watch('file')
    private async _fileChanged(file: AuxFile) {
        if (file) {
            const calc = appManager.fileManager.createContext();
            this._updateLabel(calc, file);
            this._updateColor(calc, file);
            this._updateInput(calc, file);
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
        this._fileChanged(this.file);
    }

    async click() {
        await appManager.fileManager.action('onClick', [this.file]);
        if (this.input) {
            const calc = appManager.fileManager.createContext();
            this._updateInput(calc, this.file);
            this.showDialog = true;
        }
    }

    async closeDialog() {
        if (this.showDialog) {
            await appManager.fileManager.action('onCancel', [this.file]);
            this.showDialog = false;
        }
    }

    async saveDialog() {
        if (this.showDialog) {
            await appManager.fileManager.updateFile(this.inputTarget, {
                tags: {
                    [this.input]: this.inputValue
                }
            });
            await appManager.fileManager.action('onSave', [this.file]);
            this.showDialog = false;
        }
    }

    private _updateColor(calc: FileCalculationContext, file: AuxFile) {
        if (file.tags['aux.color']) {
            this.backgroundColor = calculateFileValue(calc, file, 'aux.color');
        } else {
            this.backgroundColor = '#FFF';
        }
    }

    private _updateLabel(calc: FileCalculationContext, file: AuxFile) {
        let label = file.tags['aux.label'];
        if (label) {
            this.label = calculateFormattedFileValue(calc, file, 'aux.label');
            const labelColor = file.tags['aux.label.color'];
            if (labelColor) {
                this.labelColor = calculateFormattedFileValue(calc, file, 'aux.label.color');
            } else {
                this.labelColor = '#000';
            }
        } else {
            this.label = '';
        }
    }

    private _updateInput(calc: FileCalculationContext, file: AuxFile) {
        let input = file.tags['aux.input'];
        if (input) {
            this.input = calculateFormattedFileValue(calc, file, 'aux.input');

            if (this.input) {
                this.inputTarget = getFileInputTarget(calc, file);
                this.inputValue = calculateFormattedFileValue(calc, this.inputTarget, this.input);
                this.placeholder = getFileInputPlaceholder(calc, file) || this.input;
            }
        } else {
            this.input = '';
        }
    }
};