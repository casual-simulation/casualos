import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import GameView from '../GameView/GameView';
import { appManager } from '../AppManager';
import { gitManager } from '../GitManager';
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
    files: string[] = [];
    index: string[] = [];
    commits: git.CommitDescription[] = [];

    isLoading: boolean = false;
    progress: number = 0;
    progressMode: "indeterminate" | "determinate" = "determinate";
    
    get user() {
        return appManager.user;
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

    async checkStatus() {
        this.index = await gitManager.index();
    }

    async created() {
        this.open();
        
        this.isLoading = true;
        this.progressMode = "determinate";
        this._setStatus('Starting...');
        this.progress = (0/numLoadingSteps) * 100;
        await gitManager.startIfNeeded();

        this._setStatus('Checking for project...');
        this.progress = (1/numLoadingSteps) * 100;
        if(!(await gitManager.isProjectCloned())) {
            this._setStatus('Cloning project...');
            this.progress = (2/numLoadingSteps) * 100;
            await gitManager.cloneProject();
        } else {
            this._setStatus('Updating project...');
            this.progress = (2/numLoadingSteps) * 100;
            await gitManager.updateProject();
        }

        this.progress = (3/numLoadingSteps) * 100;
        const files: string[] = await gitManager.fs.readdir(gitManager.projectDir);
        this.files = files.filter(f => f !== '.git').sort();

        this.progress = (4/numLoadingSteps) * 100;
        this.commits = await gitManager.commitLog();
        this.isLoading = false;
        
        this._setStatus('Waiting for input...');
    }

    private _setStatus(status: string) {
        this.status = status;
        console.log('[Home] Status:', status);
    }
};