<template>
    <div class="editor-wrapper">
        <div class="editor-breadcrumbs">
            <bot-tag
                :tag="tag"
                :isScript="isScript"
                :isFormula="isFormula"
                :allowCloning="false"
            ></bot-tag>
            <div class="editor-errors">
                <div v-if="scriptErrors.length === 0">
                    No Errors
                </div>
                <div
                    v-else
                    class="editor-button"
                    :class="{ active: showErrors }"
                    @click="toggleErrors()"
                >
                    <md-icon class="error-icon">error</md-icon>
                    {{ errorsLabel }}
                </div>
            </div>
        </div>
        <div class="code-editor-wrapper">
            <div v-if="showErrors" class="errors-wrapper">
                <ul class="error-list">
                    <li v-for="(error, index) in scriptErrors" :key="index" class="error">
                        <div class="error-count">
                            <span>{{ error.count }}</span>
                        </div>
                        <div class="error-details">
                            <div class="error-name">{{ error.name }}</div>
                            <span class="error-message">{{ error.message }}</span>
                        </div>
                    </li>
                </ul>
            </div>
            <monaco-editor ref="editor" @focus="editorFocused" @blur="editorBlured"></monaco-editor>
        </div>
    </div>
</template>
<script src="./MonacoTagEditor.ts"></script>
<style src="./MonacoTagEditor.css" scoped></style>
