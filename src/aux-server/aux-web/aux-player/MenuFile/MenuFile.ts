import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject, Watch, Prop } from 'vue-property-decorator';
import {
    Bot,
    FileCalculationContext,
    calculateFormattedFileValue,
    calculateFileValue,
    isFormula,
} from '@casual-simulation/aux-common';
import { FileRenderer } from '../../shared/scene/FileRenderer';
import { MenuItem } from '../MenuContext';
import { appManager } from '../../shared/AppManager';

@Component({
    components: {},
})
export default class MenuFile extends Vue {
    @Prop() item: MenuItem;
    @Prop() index: number;
    @Prop({ default: false })
    selected: boolean;

    label: string = '';
    labelColor: string = '#000';
    backgroundColor: string = '#FFF';

    @Watch('item')
    private async _fileChanged(item: MenuItem) {
        if (item) {
            const simulation = _simulation(item);
            const calc = simulation.helper.createContext();
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
        const simulation = _simulation(this.item);
        await simulation.helper.action('onClick', [this.item.file]);
    }

    private _updateColor(calc: FileCalculationContext, file: Bot) {
        if (file.tags['aux.color']) {
            this.backgroundColor = calculateFileValue(calc, file, 'aux.color');
        } else {
            this.backgroundColor = '#FFF';
        }
    }

    private _updateLabel(calc: FileCalculationContext, file: Bot) {
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

function _simulation(item: MenuItem) {
    return appManager.simulationManager.simulations.get(item.simulationId);
}
