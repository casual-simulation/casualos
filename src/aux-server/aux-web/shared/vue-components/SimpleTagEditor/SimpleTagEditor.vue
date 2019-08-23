<template>
    <div class="simple-editor-wrapper">
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
</template>
<script src="./SimpleTagEditor.ts"></script>
<style src="./SimpleTagEditor.css" scoped></style>
