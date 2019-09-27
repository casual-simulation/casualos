import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Watch } from 'vue-property-decorator';
import { isFilterTag, isFormula, Bot } from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { SubscriptionLike } from 'rxjs';
import { appManager } from '../../AppManager';
import FileTag from '../FileTag/FileTag';
import { isFocused } from '../VueHelpers';

@Component({
    components: {
        'file-tag': FileTag,
    },
})
export default class SimpleTagEditor extends Vue {
    @Prop({ required: true }) tag: string;
    @Prop({ required: true }) file: Bot;

    tagValue: any = '';

    private _simulation: BrowserSimulation;
    private _sub: SubscriptionLike;

    get isTagFormula(): boolean {
        return isFormula(this.tagValue);
    }

    get isTagScript(): boolean {
        return isFilterTag(this.tag);
    }

    @Watch('tag')
    tagChanged() {
        this._updateValue();
    }

    @Watch('file')
    botChanged() {
        this._updateValue();
    }

    @Watch('tagValue')
    valueChanged() {
        let file = this.file;
        let tag = this.tag;
        let value = this.tagValue;
        this._updateFile(file, tag, value);
    }

    created() {
        this._sub = appManager.whileLoggedIn((user, sim) => {
            this._simulation = sim;
            return [];
        });
        this._updateValue();
    }

    destroyed() {
        if (this._sub) {
            this._sub.unsubscribe();
        }
    }

    private _updateFile(file: Bot, tag: string, value: any) {
        if (!isFocused(this.$el)) {
            return;
        }
        this._simulation.editBot(file, tag, value);
    }

    private _updateValue() {
        if (isFocused(this.$el)) {
            return;
        }

        if (this.tag && this.file) {
            this.tagValue = this.file.tags[this.tag];
        } else {
            this.tagValue = '';
        }
    }
}
