<template>
    <div class="container-root">
        <div class="container-header">
            <div class="title-container">
                <md-icon>code</md-icon>
                <label>Source Control</label>
            </div>
            <div class="spacer-div"></div>
        </div>
        <div class="container-body">
            <file-system-panel class="container-body-fs" :scc="scc"></file-system-panel>
            <div class="spacer-div"></div>
            <div class="list-container">
                <md-button class="btn btn-primary shadow-box" @click="$emit('init-repo')"
                    >Init</md-button
                >
                <md-button class="btn btn-primary shadow-box" @click="$emit('clone-repo')"
                    >Clone</md-button
                >
                <md-button class="btn btn-secondary shadow-box" @click="$emit('load-repo')"
                    >Load Local</md-button
                >
            </div>
        </div>
        <div class="container-footer">
            <div class="spacer-div"></div>
            <div class="info-with-action">
                <!-- <i class="important-text">No Bot Selected.</i>
                <i class="information-text">Select a bot to enable source control features.</i> -->
            </div>
        </div>
    </div>
</template>
<style>
.container-root {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.container-body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex-grow: 12;
}

.container-body-fs {
    flex-grow: 13;
}

.container-footer {
    flex-grow: 1;
}

.title-container {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
}

.spacer-div {
    background-color: rgba(0, 0, 0, 0.1);
    height: 1px;
    margin: 8px 0;
}

.spacer-div-vert {
    background-color: rgba(0, 0, 0, 0.1);
    width: 1px;
    margin: 0 8px;
}

.info-with-action {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-self: center;
    gap: 4px;
    padding: 0 10px;
}

.important-text {
    font-weight: bold;
    color: #d9534f;
}

.information-text {
    font-size: 0.9em;
    color: #858585aa;
}

.list-container {
    padding-top: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 10px;
    flex-grow: 1;
}

.shadow-box {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.list-container .btn {
    width: 100%;
    max-width: 200px;
    box-sizing: border-box;
}
</style>
<script src="./DefaultPanel.ts"></script>
