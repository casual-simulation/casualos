import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Prop, Inject} from 'vue-property-decorator';
import { appManager } from '../AppManager';

@Component({})
export default class MergeConflicts extends Vue {

    get fileManager() {
        return appManager.fileManager;
    }

    constructor() {
        super();
    }
};