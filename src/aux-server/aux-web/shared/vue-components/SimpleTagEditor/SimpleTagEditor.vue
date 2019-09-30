<template>
    <div class="simple-editor-wrapper">
        <md-field>
            <label><bot-tag :tag="tag"></bot-tag></label>
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
