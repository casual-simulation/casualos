<template>
    <div v-if="!showDesktopEditor">
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
    <monaco-editor v-else ref="editor" @input="tagValue = $event"></monaco-editor>
</template>
<script src="./TagValueEditor.ts"></script>
<style src="./TagValueEditor.css" scoped></style>
