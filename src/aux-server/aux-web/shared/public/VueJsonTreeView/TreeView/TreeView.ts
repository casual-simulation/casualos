/**
 * MIT License
 *
 * Copyright (c) 2017 Arvid Kahl
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * @license MIT
 */

import { map, last, drop, dropRight, cloneDeep, extend, isPlainObject }  from 'lodash';
import TreeViewItem from '../TreeViewItem/TreeViewItem';

export default {
    components: {
        TreeViewItem,
    },
    name: 'tree-view',
    props: ['data', 'options'],
    methods: {
        // Transformer for the non-Collection types,
        // like String, Integer of Float
        transformValue: function(valueToTransform: any, keyForValue: string) {
            return {
                key: keyForValue,
                type: 'value',
                value: valueToTransform,
            };
        },

        // Since we use lodash, the _.map method will work on
        // both Objects and Arrays, returning either the Key as
        // a string or the Index as an integer
        generateChildrenFromCollection: function(collection: any[]) {
            return map(collection, (value, keyOrIndex) => {
                if (this.isObject(value)) {
                    return this.transformObject(value, keyOrIndex);
                }
                if (this.isArray(value)) {
                    return this.transformArray(value, keyOrIndex);
                }
                if (this.isValue(value)) {
                    return this.transformValue(value, keyOrIndex);
                }
            });
        },

        // Transformer for the Array type
        transformArray: function(arrayToTransform: any[], keyForArray: string) {
            return {
                key: keyForArray,
                type: 'array',
                children: this.generateChildrenFromCollection(arrayToTransform),
            };
        },

        // Transformer for the Object type
        transformObject: function(
            objectToTransform: any,
            keyForObject: string,
            isRootObject = false
        ) {
            return {
                key: keyForObject,
                type: 'object',
                isRoot: isRootObject,
                children: this.generateChildrenFromCollection(
                    objectToTransform
                ),
            };
        },

        // Helper Methods for value type detection
        isObject: function(value: any) {
            return isPlainObject(value);
        },

        isArray: function(value: any) {
            return Array.isArray(value);
        },

        isValue: function(value: any) {
            return !this.isObject(value) && !this.isArray(value);
        },

        onChangeData: function(path: string[], value: any) {
            let lastKey = last(path);
            path = dropRight(drop(path));

            let data = cloneDeep(this.data);
            let targetObject = data;
            path.forEach(key => {
                targetObject = targetObject[key];
            });

            if (targetObject[lastKey] != value) {
                targetObject[lastKey] = value;
                this.$emit('change-data', data);
            }
        },
    },
    computed: {
        allOptions: function() {
            return extend(
                {},
                {
                    rootObjectKey: 'root',
                    maxDepth: 4,
                    limitRenderDepth: false,
                    modifiable: false,
                    link: false,
                },
                this.options || {}
            );
        },
        parsedData: function() {
            // Take the JSON data and transform
            // it into the Tree View DSL

            // Strings or Integers should not be attempted to be split, so we generate
            // a new object with the string/number as the value
            if (this.isValue(this.data)) {
                return this.transformValue(
                    this.data,
                    this.allOptions.rootObjectKey
                );
            }

            // If it's an object or an array, transform as an object
            return this.transformObject(
                this.data,
                this.allOptions.rootObjectKey,
                true
            );
        },
    },
};
