<template>
    <div class="editor-action-section">
        <slot v-if="reactiveStore.editorPanel.currentPanel == SccEditorPanel.Initialize">
            <md-card class="editor-action-card-init-repo">
                <md-card-header>
                    <div class="md-title action-card-title">Repository Setup</div>
                    <div class="md-subhead">
                        Initialize a new repository or open an existing one.
                    </div>
                </md-card-header>

                <md-card-content>
                    <div class="md-radio-container">
                        <md-radio v-model="setupOption" name="setupOption" value="init"
                            >Initialize New Repository</md-radio
                        >
                        <md-radio v-model="setupOption" name="setupOption" value="open"
                            >Open Existing Repository</md-radio
                        >
                        <md-radio v-model="setupOption" name="setupOption" value="clone"
                            >Clone Remote Repository</md-radio
                        >
                    </div>

                    <slot v-if="setupOption == 'init'">
                        <md-field>
                            <label>Repository Name</label>
                            <md-input v-model="repoName" @keypress="filterKey" type="text" />
                        </md-field>
                    </slot>
                    <slot v-else-if="setupOption == 'open'">
                        <md-field>
                            <label>Repository Path</label>
                            <md-input v-model="repoPath" @keypress="filterPathKey" type="text" />
                        </md-field>
                    </slot>
                    <slot v-else-if="setupOption == 'clone'">
                        <md-field>
                            <label>Repository URL</label>
                            <md-input v-model="repoUrl" type="text" />
                        </md-field>
                    </slot>

                    <!-- <md-field>
                        <label>Working Directory</label>
                        <md-input v-model="workingDir" @keypress="filterPathKey" type="text" />
                    </md-field> -->
                </md-card-content>

                <md-card-actions class="action-card-submit">
                    <md-button class="md-raised md-primary" @click="submitForm"> Next </md-button>
                </md-card-actions>
            </md-card>
        </slot>
    </div>
</template>
<style>
.editor-action-card-init-repo {
    text-align: center;
    height: 100%;
}

.action-card-submit {
    display: flex;
    height: 100%;
    box-sizing: border-box;
}

.action-card-title {
    margin-bottom: 5px !important;
}
</style>
<script src="./EditorActionSection.ts"></script>
