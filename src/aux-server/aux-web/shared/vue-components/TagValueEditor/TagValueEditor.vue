<template>
    <div
        v-if="!showDesktopEditor"
        class="simple-editor-wrapper"
        :class="{ editor: showDesktopEditor }"
    >
        <md-field>
            <label><file-tag :tag="tag"></file-tag></label>
            <md-textarea
                ref="multiLineEditor"
                v-model="tagValue"
                class="simple-editor"
                :class="[{ formula: isTagFormula }]"
            >
            </md-textarea>
        </md-field>
    </div>
    <div v-else class="editor-wrapper">
        <div class="editor-breadcrumbs">
            <file-tag :tag="tag"></file-tag>
        </div>
        <div class="code-editor-wrapper">
            <monaco-editor ref="editor" @focus="editorFocused" @blur="editorBlured"></monaco-editor>
        </div>
    </div>
</template>
<script src="./TagValueEditor.ts"></script>
<style src="./TagValueEditor.css" scoped></style>
