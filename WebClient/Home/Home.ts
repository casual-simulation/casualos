import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import GameView from '../GameView/GameView';
import { EventBus } from '../EventBus/EventBus';
import { appManager } from '../AppManager';
import { gitManager } from '../GitManager';
import { fileManager } from '../FileManager';
import {File} from '../Core/File';
import CubeIcon from './Cube.svg';
import { FileData } from 'WebClient/Core/FileData';

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
    tags: string[] = [];
    isMakingNewTag: boolean = false;
    newTag: string = 'myNewTag';

    isLoading: boolean = false;
    progress: number = 0;
    progressMode: "indeterminate" | "determinate" = "determinate";

    get user() {
        return appManager.user;
    }

    canSave() {
        return fileManager.canSave;
    }

    open() {
        this.isOpen = true;
    }

    close() {
        this.isOpen = false;
    }

    addNewFile() {
        fileManager.createFile();
    }

    addNewWorkspace() {
        fileManager.createWorkspace();
    }

    save() {
        fileManager.save();
    }

    addTag() {
        if (this.isMakingNewTag) {
            this.tags.push(this.newTag);
        }
        this.isMakingNewTag = !this.isMakingNewTag;
    }

    valueChanged(file: File, tag: string, value: string) {
        if (file.data.type === 'file') {
            fileManager.updateFile(file, {
                tags: {
                    [tag]: value
                }
            });
        }
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
        this.tags = fileManager.tags;

        this.commits = await gitManager.commitLog();
        this.isLoading = false;
        
        this._setStatus('Waiting for input...');
    }

    private _setStatus(status: string) {
        this.status = status;
        console.log('[Home] Status:', status);
    }
};