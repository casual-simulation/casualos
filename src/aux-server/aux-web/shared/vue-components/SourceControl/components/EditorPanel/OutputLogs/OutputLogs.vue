<template>
    <div class="output-logs-root">
        <div class="output-title-bar">
            <div>
                <span>Logs</span>
            </div>
            <div>
                <md-button @click="downloadOutputLogs">
                    <md-icon>download</md-icon>
                </md-button>
                <md-button @click="toggleOutputScroll"
                    ><md-icon>{{ outputAutoScroll ? 'pause' : 'play_arrow' }}</md-icon></md-button
                >
                <md-button @click="clearOutputLogs"><md-icon>delete_forever</md-icon></md-button>
            </div>
        </div>
        <div class="output-logs" ref="logs">
            <div v-for="(log, index) in reactiveStore.outputPanel.logs" :key="index">
                <i class="output-log-type-tms">@{{ log[0]?.tms ?? 'NA' }}</i
                ><span :class="`output-log-type-scope output-log-type-${log[0]?.lvl ?? 'info'}`">{{
                    log[0]?.scope?.join(' > ') ?? ''
                }}</span
                ><span>{{ log[1] ?? '' }}</span>
            </div>
        </div>
    </div>
</template>

<style>
.output-logs-root {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
}

.output-title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1px 1px 0 1px;
}

.output-title-bar > div {
    align-self: flex-end;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
    width: fit-content;
    padding: 2px 10px;
    cursor: pointer;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    height: fit-content;
}

.output-title-bar .md-button {
    font-size: 12px;
    min-width: unset;
    margin: 0;
}

.output-logs {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-wrap: break-word;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);
    color: grey;
    border-radius: 4px;
    border-top-left-radius: 0;
    background: linear-gradient(55deg, rgba(255, 255, 255, 0.5), rgba(241, 241, 241, 0.5));
    padding: 8px 15px;
}

.output-log-type-tms {
    font-size: 50%;
    color: #999;
    margin-right: 6px;
}

.output-log-type-scope {
    font-weight: bold;
    margin-right: 6px;
}

.output-log-type-info {
    color: #466f9a99;
}

.output-log-type-warning {
    color: #ffc107;
}

.output-log-type-error {
    color: #dc3545;
}
</style>

<script src="./OutputLogs.ts"></script>
