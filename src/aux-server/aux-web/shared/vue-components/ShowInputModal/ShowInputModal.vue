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
                    <p v-if="currentType === 'list' && items.length === 0">There are no items.</p>
                    <md-field v-else-if="isSelect">
                        <!-- List {{currentSubtype}} -->
                        <label for="input-list" :style="{ color: labelColor }">{{
                            currentPlaceholder
                        }}</label>
                        <md-select
                            v-model="currentValue"
                            v-if="currentSubtype === 'multiSelect'"
                            ref="inputModalField"
                            multiple
                            id="input-list"
                        >
                            <md-option
                                v-for="(option, index) in items"
                                :key="index"
                                :value="index"
                                :style="{ color: labelColor }"
                            >
                                {{ option.label }}
                            </md-option>
                        </md-select>
                        <md-select v-model="currentValue" v-else id="input-list">
                            <!-- <md-option value="Test1">Option 1</md-option>
                            <md-option value="Test2">Option 2</md-option> -->
                            <md-option
                                v-for="(option, index) in items"
                                :key="index"
                                :value="index"
                                :style="{ color: labelColor }"
                            >
                                {{ option.label }}
                            </md-option>
                        </md-select>
                    </md-field>
                    <div v-else-if="currentType === 'list' && currentSubtype === 'radio'">
                        <md-radio
                            v-model="currentValue"
                            v-for="(option, index) in items"
                            :key="index"
                            :value="index"
                            >{{ option.label }}</md-radio
                        >
                    </div>
                    <div v-else-if="currentType === 'list' && currentSubtype === 'checkbox'">
                        <md-checkbox
                            v-model="currentValue"
                            v-for="(option, index) in items"
                            :key="index"
                            :value="index"
                            >{{ option.label }}</md-checkbox
                        >
                    </div>
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
<style src="./ShowInputModalGlobal.css"></style>
