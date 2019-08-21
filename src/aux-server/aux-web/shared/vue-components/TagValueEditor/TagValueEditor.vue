<template>
    <div
        v-if="!showDesktopEditor"
        class="multi-line-tag-value-wrapper"
        :class="{ editor: showDesktopEditor }"
    >
        <md-field>
            <label><file-tag :tag="tag"></file-tag></label>
            <md-textarea
                ref="multiLineEditor"
                v-model="tagValue"
                class="multi-line-tag-value-editor"
                :class="[{ formula: isTagFormula }]"
            >
            </md-textarea>
        </md-field>
    </div>
    <div v-else class="editor-wrapper">
        <div class="editor-breadcrumbs">
            <file-tag :tag="tag"></file-tag>
        </div>
        <monaco-editor ref="editor" @focus="editorFocused" @blur="editorBlured"></monaco-editor>
    </div>
</template>
<script src="./TagValueEditor.ts"></script>
<style src="./TagValueEditor.css" scoped></style>
