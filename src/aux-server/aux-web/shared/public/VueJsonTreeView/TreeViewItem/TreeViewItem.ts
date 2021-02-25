import { concat } from 'lodash';
import TreeViewItemValue from '../TreeViewItemValue/TreeViewItemValue';

export default {
    components: {
        TreeViewItemValue,
    },
    name: 'tree-view-item',
    props: [
        'data',
        'max-depth',
        'current-depth',
        'modifiable',
        'link',
        'limit-render-depth',
    ],
    data: function() {
        return {
            open: this.currentDepth < this.maxDepth,
        };
    },
    methods: {
        isOpen: function() {
            return this.open;
        },
        toggleOpen: function() {
            this.open = !this.open;
        },
        isObject: function(value: any) {
            return value.type === 'object';
        },
        isArray: function(value: any) {
            return value.type === 'array';
        },
        isValue: function(value: any) {
            return value.type === 'value';
        },
        getKey: function(value: any) {
            if (Number.isInteger(value.key)) {
                return value.key + ':';
            } else {
                return '"' + value.key + '":';
            }
        },
        isRootObject: function(value = this.data) {
            return value.isRoot;
        },
        onChangeData: function(path: string[], value: any) {
            path = concat(this.data.key, path);
            this.$emit('change-data', path, value);
        },
    },
};
