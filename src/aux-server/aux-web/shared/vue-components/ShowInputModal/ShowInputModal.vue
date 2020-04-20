<template>
    <div>
        <md-dialog
            :md-active.sync="showInputDialog"
            @md-closed="saveInputDialog()"
            @md-opened="autoFocusInputDialog()"
            class="input-dialog"
            :style="{
                'background-color': inputDialogBackgroundColor,
                color: inputDialogLabelColor,
            }"
        >
            <md-dialog-title v-show="inputDialogLabel">{{ inputDialogLabel }}</md-dialog-title>
            <md-dialog-content class="input-dialog-content">
                <md-field>
                    <label :style="{ color: inputDialogLabelColor }">{{
                        inputDialogPlaceholder
                    }}</label>
                    <md-input
                        v-model="inputDialogInputValue"
                        @keyup.enter="saveInputDialog()"
                        ref="inputModalField"
                        style="-webkit-text-fill-color: inherit;"
                        :style="{ color: inputDialogLabelColor }"
                    ></md-input>
                </md-field>
                <div class="input-dialog-color-tools" v-if="inputDialogType === 'color'">
                    <color-picker-swatches
                        v-if="inputDialogSubtype === 'swatch'"
                        :value="inputDialogInputValue"
                        @input="updateInputDialogColor"
                        :disableAlpha="true"
                    ></color-picker-swatches>
                    <color-picker-advanced
                        v-else-if="inputDialogSubtype === 'advanced'"
                        :value="inputDialogInputValue"
                        @input="updateInputDialogColor"
                        class="color-picker-advanced"
                        :disableAlpha="true"
                    ></color-picker-advanced>
                    <color-picker-basic
                        v-else
                        :value="inputDialogInputValue"
                        @input="updateInputDialogColor"
                        class="color-picker-basic"
                        :disableAlpha="true"
                    ></color-picker-basic>
                </div>
            </md-dialog-content>
        </md-dialog>
    </div>
</template>
<script src="./ShowInputModal.ts"></script>
<style src="./ShowInputModal.css" scoped></style>
