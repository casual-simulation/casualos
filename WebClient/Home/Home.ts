import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../AppManager';
import GameView from '../GameView/GameView';
import * as git from 'isomorphic-git';

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
        this.status = 'Starting...';
        await appManager.startIfNeeded();

        this.status = 'Checking for project...';

        if(!(await appManager.isProjectCloned())) {
            this.status = 'Cloning project...';
            await appManager.cloneProject();
        } else {
            this.status = 'Updating project...';
            await appManager.updateProject();
        }
        const files: string[] = await appManager.fs.readdir(appManager.projectDir);
        this.files = files.filter(f => f !== '.git').sort();

        this.commits = await appManager.commitLog();
        
        this.status = 'Waiting for input...';
    }
};