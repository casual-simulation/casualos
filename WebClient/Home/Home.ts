import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import GameView from '../GameView/GameView';
import { appManager } from '../AppManager';
import { gitManager } from '../GitManager';

@Component({
    components: {
        'game-view': GameView
    }
})
export default class Home extends Vue {

    status: string = '';
    files: string[] = [];
    commits: git.CommitDescription[] = [];
    
    get user() {
        return appManager.user;
    }

    async created() {
        this._setStatus('Starting...');
        await gitManager.startIfNeeded();

        this._setStatus('Checking for project...');

        if(!(await gitManager.isProjectCloned())) {
            this._setStatus('Cloning project...');
            await gitManager.cloneProject();
        } else {
            this._setStatus('Updating project...');
            await gitManager.updateProject();
        }
        const files: string[] = await gitManager.fs.readdir(gitManager.projectDir);
        this.files = files.filter(f => f !== '.git').sort();

        this.commits = await gitManager.commitLog();
        
        this._setStatus('Waiting for input...');
    }

    private _setStatus(status: string) {
        console.log('[Home] Status:', status);
    }
};