import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../AppManager';

@Component
export default class Home extends Vue {

    status: string = '';
    
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
            console.log(await appManager.fs.readdir(appManager.projectDir));
        } else {
            this.status = 'Updating project...';
            await appManager.updateProject();
        }
        this.status = 'Waiting for input...';
    }
};