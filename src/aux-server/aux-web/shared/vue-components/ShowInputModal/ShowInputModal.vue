<template>
    <div>
        <md-dialog
            :md-active.sync="showInputDialog"
            :md-fullscreen="false"
            @md-closed="saveInputDialog()"
            @md-opened="autoFocusInputDialog()"
            class="input-dialog"
        >
            <div
                class="input-dialog-container"
                :style="{
                    'background-color': backgroundColor,
                    color: labelColor,
                }"
            >
                <md-dialog-title v-show="currentLabel">{{ currentLabel }}</md-dialog-title>
                <md-dialog-content class="input-dialog-content">
                    <md-datepicker
                        v-model="currentValue"
                        v-if="currentType === 'date'"
                        md-immediately
                        ref="inputModalField"
                    >
                        <label :style="{ color: labelColor }">{{ currentPlaceholder }}</label>
                    </md-datepicker>
                    <md-field v-else>
                        <label :style="{ color: labelColor }">{{ currentPlaceholder }}</label>
                        <md-immediate-input
                            v-model="currentValue"
                            @keyup.enter="saveInputDialog()"
                            :type="currentType === 'secret' ? 'password' : 'text'"
                            ref="inputModalField"
                            style="-webkit-text-fill-color: inherit"
                            :style="{ color: labelColor }"
                        ></md-immediate-input>
                    </md-field>
                    <div class="input-dialog-color-tools" v-if="currentType === 'color'">
                        <color-picker-swatches
                            v-if="currentSubtype === 'swatch'"
                            :value="currentValue"
                            @input="updateInputDialogColor"
                            :disableAlpha="true"
                        ></color-picker-swatches>
                        <color-picker-advanced
                            v-else-if="currentSubtype === 'advanced'"
                            :value="currentValue"
                            @input="updateInputDialogColor"
                            class="color-picker-advanced"
                            :disableAlpha="true"
                        ></color-picker-advanced>
                        <color-picker-basic
                            v-else
                            :value="currentValue"
                            @input="updateInputDialogColor"
                            class="color-picker-basic"
                            :disableAlpha="true"
                        ></color-picker-basic>
                    </div>
                </md-dialog-content>
            </div>
        </md-dialog>
    </div>
</template>
<script src="./ShowInputModal.ts"></script>
<style src="./ShowInputModal.css" scoped></style>
