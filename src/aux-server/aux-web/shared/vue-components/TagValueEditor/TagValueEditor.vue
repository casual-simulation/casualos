<template>
    <div v-if="isMobile">
        <md-field>
            <label><file-tag :tag="tag"></file-tag></label>
            <md-textarea
                ref="multiLineEditor"
                v-model="tagValue"
                class="multi-line-tag-value-editor"
                :class="[{ formula: isFocusedTagFormula }]"
            >
            </md-textarea>
        </md-field>
    </div>
    <div v-else>
        <monaco-editor ref="editor"></monaco-editor>
    </div>
</template>
<script src="./TagValueEditor.ts"></script>
<style src="./TagValueEditor.css" scoped></style>
