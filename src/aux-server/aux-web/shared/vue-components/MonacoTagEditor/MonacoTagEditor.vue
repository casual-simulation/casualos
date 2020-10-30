<template>
    <div class="editor-wrapper">
        <div class="editor-breadcrumbs" :class="{ 'show-resize': showResize }">
            <bot-tag
                :tag="tag"
                :isScript="isScript"
                :isFormula="isFormula"
                :allowCloning="false"
            ></bot-tag>
            <div v-if="!!space" class="bot-space">
                {{ space }}
            </div>
            <div class="editor-spacing"></div>
            <div class="editor-docs">
                <a class="md-button md-dense md-theme-default" :href="docsLink" target="_blank"
                    >docs</a
                >
            </div>
            <div class="editor-toggles">
                <md-button @click="makeNormalTag()" class="md-dense" :class="{ active: !isScript }">
                    <md-tooltip>Make Normal Tag</md-tooltip>
                    <span class="hashtag">#</span>
                </md-button>
                <md-button @click="makeScriptTag()" class="md-dense" :class="{ active: isScript }">
                    <md-tooltip>Make Listen Tag</md-tooltip>
                    <span class="at-symbol">@</span>
                </md-button>
            </div>
            <div class="editor-errors">
                <div v-if="scriptErrors.length === 0">No Errors</div>
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
            <div v-if="signed" class="editor-signed">
                <div>
                    <md-icon>verified_user</md-icon>
                    <md-tooltip md-direction="top">Verified</md-tooltip>
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
            <monaco-editor
                ref="editor"
                @focus="editorFocused"
                @blur="editorBlured"
                @editorMounted="onEditorMounted"
            ></monaco-editor>
        </div>
    </div>
</template>
<script src="./MonacoTagEditor.ts"></script>
<style src="./MonacoTagEditor.css" scoped></style>
