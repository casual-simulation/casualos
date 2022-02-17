<template>
    <div class="editor-wrapper">
        <div class="editor-breadcrumbs" :class="{ 'show-resize': showResize }">
            <div class="editor-tag">
                <bot-tag :tag="tag" :prefix="currentPrefix" :allowCloning="false"></bot-tag>
                <div v-if="!!space" class="bot-space">
                    {{ space }}
                </div>
            </div>
            <div class="editor-spacing"></div>
            <div class="editor-error" v-show="hasError">
                <md-button
                    @click="toggleShowError()"
                    class="md-dense"
                    :class="{ active: showingError }"
                    >Show Error</md-button
                >
            </div>
            <div class="editor-docs">
                <a class="md-button md-dense md-theme-default" :href="docsLink" target="_blank"
                    >docs</a
                >
            </div>
            <div class="editor-toggles">
                <md-button
                    @click="makeNormalTag()"
                    class="md-dense"
                    :class="{ active: !(isScript || isFormula || isAnyPrefix) }"
                >
                    <md-tooltip>Make Normal Tag</md-tooltip>
                    <span class="hashtag">#</span>
                </md-button>
                <md-button @click="makeDnaTag()" class="md-dense" :class="{ active: isFormula }">
                    <md-tooltip>Make Mod Tag</md-tooltip>
                    <span class="dna-symbol">🧬</span>
                </md-button>
                <md-button @click="makeScriptTag()" class="md-dense" :class="{ active: isScript }">
                    <md-tooltip>Make Listen Tag</md-tooltip>
                    <span class="at-symbol">@</span>
                </md-button>
                <md-button
                    v-for="prefix in scriptPrefixes"
                    :key="prefix.prefix"
                    @click="makePrefixTag(prefix)"
                    class="md-dense"
                    :class="{ active: isPrefix(prefix) }"
                >
                    <md-tooltip>Make Custom Portal Tag</md-tooltip>
                    <span>{{ prefix.prefix }}</span>
                </md-button>
            </div>
            <div v-if="signed" class="editor-signed">
                <div>
                    <md-icon>verified_user</md-icon>
                    <md-tooltip md-direction="top">Verified</md-tooltip>
                </div>
            </div>
        </div>
        <div class="code-editor-wrapper">
            <monaco-editor
                ref="editor"
                @focus="editorFocused"
                @blur="editorBlured"
                @editorMounted="onEditorMounted"
                @modelChanged="onModelChanged"
            ></monaco-editor>
        </div>
    </div>
</template>
<script src="./MonacoTagEditor.ts"></script>
<style src="./MonacoTagEditor.css" scoped></style>
<style src="./MonacoTagEditorUnscoped.css"></style>
