<template>
    <md-menu class="tag-editor" md-size="medium" md-align-trigger :md-active="showMenu">
        <span v-if="!useMaterialInput">
            ><input
                ref="inputBox"
                :value="editorValue"
                @input="onInput($event.target.value)"
                @focus.stop="onFocus"
                @blur.stop="onBlur"
                autocapitalize="none"
                autocorrect="off"
            />
        </span>
        <span v-else>
            <md-field ref="mdField">
                <input
                    class="md-input"
                    ref="inputBox"
                    v-bind:value="editorValue"
                    :placeholder="placeholder"
                    v-on:input="onInput"
                    @focus.stop="onFocus"
                    @blur.stop="onBlur"
                    autocapitalize="none"
                    autocorrect="off"
                />
            </md-field>
        </span>

        <md-menu-content class="tag-editor-menu">
            <md-menu-item v-if="errorMessage" class="tag-editor-error">
                {{ errorMessage }}
            </md-menu-item>

            <template v-if="isOpen" class="tag-editor-autofill-holder">
                <md-menu-item
                    ref="knownTags"
                    v-for="(result, i) in results"
                    :key="i"
                    @click="onAutoFill(result)"
                >
                    {{ result }}
                </md-menu-item>
            </template>
        </md-menu-content>
    </md-menu>
</template>
<script src="./TagEditor.ts"></script>
<style src="./TagEditor.css"></style>
