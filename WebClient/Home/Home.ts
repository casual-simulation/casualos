import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import GameView from '../GameView/GameView';
import { EventBus } from '../EventBus/EventBus';
import { appManager } from '../AppManager';
import { gitManager } from '../GitManager';
import { fileManager } from '../FileManager';
import {File} from '../Core/File';
import {createFile} from '../Core/Event';
import CubeIcon from './Cube.svg';

const numLoadingSteps: number = 4;

@Component({
    components: {
        'game-view': GameView,
        'cube-icon': CubeIcon
    }
})
export default class Home extends Vue {

    isOpen: boolean = false;
    status: string = '';
    files: File[] = [];
    index: string[] = [];
    commits: git.CommitDescription[] = [];

    isLoading: boolean = false;
    progress: number = 0;
    progressMode: "indeterminate" | "determinate" = "determinate";

    get user() {
        return appManager.user;
    }
    
    canSave(): boolean {
        return fileManager.canSave();
    }

    open() {
        this.isOpen = true;
    }

    close() {
        this.isOpen = false;
    }
    

    addNewFile() {
        appManager.events.next(createFile());
    }

    save() {
        fileManager.save();
    }

    async checkStatus() {
        this.index = await gitManager.index();
    }

    async created() {
        EventBus.$on('openInfoCard', this.open);
        this.open();
        
        this.isLoading = true;
        this._setStatus('Pulling...');
        await fileManager.pull();

        this.files = fileManager.files;

        this.commits = await gitManager.commitLog();
        this.isLoading = false;
        
        this._setStatus('Waiting for input...');
    }

    private _setStatus(status: string) {
        this.status = status;
        console.log('[Home] Status:', status);
    }
};