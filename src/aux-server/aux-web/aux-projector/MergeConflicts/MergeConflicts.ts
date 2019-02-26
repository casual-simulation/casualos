import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Prop, Inject} from 'vue-property-decorator';
import { appManager } from '../AppManager';
import {
    ConflictDetails,
    ResolvedConflict,
    first,
    second,
    File,
    fileTags
} from '@yeti-cgi/aux-common';
import { groupBy, keys, uniq, assign } from 'lodash';
import FileTag from '../FileTag/FileTag';

interface FileConflicts {
    id: string;
    first: File,
    second: File;
    tags: string[];
    conflicts: ConflictDetails[];
}

@Component({
    components: {
        'file-tag': FileTag
    }
})
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

    conflictName(conflict: ConflictDetails) {
        const index = conflict.path.indexOf('tags') + 1;
        if (index >= 0) {
            const tagName = conflict.path.slice(index);
            return tagName.join('.');
        } else {
            return conflict.path.join('.');
        }
    }

    created() {
        const conflicts = appManager.fileManager.mergeStatus.remainingConflicts.slice();
        const grouped = groupBy(conflicts, 'path[0]');
        const ids = keys(grouped);

        this.files = ids.map(id => {
            let first = assign({}, appManager.fileManager.mergeStatus.merge.first[id]);
            first.id += '-first';
            let second = assign({}, appManager.fileManager.mergeStatus.merge.second[id]);
            second.id += '-second';
            return {
                id: id,
                first: first,
                second: second,
                tags: fileTags([first,second], this._conflictingTags(grouped[id]), []),
                conflicts: grouped[id].map(g => g)
            };
        });
    }

    takeValue(file: FileConflicts, conflict: ConflictDetails, value: boolean) {
        if (typeof value !== 'boolean') {
            return;
        }
        this.resolved.push({
            value: conflict.conflict[value ? first : second],
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
        this.$router.push({ name: 'home', params: { id: appManager.user.channelId } });
    }

    private _conflictingTags(conflicts: ConflictDetails[]) {
        return uniq(conflicts.map(c => c.path[2]));
    }
};