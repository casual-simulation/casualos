import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Prop, Inject} from 'vue-property-decorator';
import { appManager } from '../AppManager';
import { ConflictDetails, ResolvedConflict, first, second } from 'common/Files';
import { groupBy, keys } from 'lodash';

interface FileConflicts {
    id: string;
    conflicts: ConflictDetails[];
}

@Component({})
export default class MergeConflicts extends Vue {

    files: FileConflicts[] = [];
    resolved: ResolvedConflict[] = [];
    first = first;
    second = second;

    get fileManager() {
        return appManager.fileManager;
    }

    constructor() {
        super();
        this.files = [];
        this.resolved = [];
    }

    created() {
        const conflicts = appManager.fileManager.mergeStatus.remainingConflicts.slice();
        const grouped = groupBy(conflicts, 'path[0]');
        const ids = keys(grouped);

        this.files = ids.map(id => ({
            id: id,
            conflicts: conflicts
        }));
    }

    takeValue(file: FileConflicts, conflict: ConflictDetails, value: any) {
        this.resolved.push({
            value: value,
            details: conflict
        });

        let index = file.conflicts.indexOf(conflict);
        if (index >= 0) {
            file.conflicts.splice(index, 1);
            if (file.conflicts.length <= 0) {
                index = this.files.indexOf(file);
                if (index >= 0) {
                    this.files.splice(0, 1);
                }
            }
        }
    }

    finish() {
        appManager.fileManager.resolveConflicts(this.resolved);
        this.$router.push('/home');
    }
};