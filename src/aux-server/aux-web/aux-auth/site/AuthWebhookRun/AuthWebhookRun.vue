<template>
    <div class="webhook-run-container">
        <md-card>
            <md-card-content>
                <div class="info-container">
                    <div class="details">
                        <md-list>
                            <md-list-item>
                                <md-icon>info</md-icon>
                                <span class="md-list-item-text">ID: {{ run.runId }}</span>
                            </md-list-item>
                            <md-list-item>
                                <md-icon>schedule</md-icon>
                                <span class="md-list-item-text"
                                    >Request Time:
                                    <relative-time :millis="run.requestTimeMs"></relative-time
                                ></span>
                            </md-list-item>
                            <md-list-item>
                                <md-icon>schedule</md-icon>
                                <span class="md-list-item-text"
                                    >Response Time:
                                    <relative-time :millis="run.responseTimeMs"></relative-time
                                ></span>
                            </md-list-item>
                            <md-list-item>
                                <md-icon>schedule</md-icon>
                                <span class="md-list-item-text"
                                    >Status Code: {{ run.statusCode }}</span
                                >
                            </md-list-item>
                            <md-list-item>
                                <md-icon>schedule</md-icon>
                                <span class="md-list-item-text">Duration: {{ runDuration }}ms</span>
                            </md-list-item>
                        </md-list>

                        <div v-if="run.errorResult">
                            <h4>Error Code</h4>
                            <p>{{ run.errorResult.errorCode }}</p>

                            <h4>Error Message</h4>
                            <p>{{ run.errorResult.errorMessage }}</p>
                        </div>
                    </div>
                    <div class="file">
                        <md-progress-spinner
                            md-mode="indeterminate"
                            :md-diameter="20"
                            :md-stroke="2"
                            v-if="isLoadingFile"
                        >
                        </md-progress-spinner>

                        <div v-if="runFile && runFile.version === 1">
                            <md-tabs>
                                <md-tab id="request" md-label="Request">
                                    <pre><code>{{ JSON.stringify(runFile.request, undefined, 2) }}</code></pre>
                                </md-tab>
                                <md-tab id="response" md-label="Response">
                                    <pre><code>{{ JSON.stringify(runFile.response, undefined, 2) }}</code></pre>
                                </md-tab>
                                <md-tab id="logs" md-label="Logs">
                                    <pre><code>{{ runFile.logs.join('\n') }}</code></pre>
                                </md-tab>
                                <md-tab id="state" md-label="State">
                                    <pre><code>{{ JSON.stringify(runFile.state, undefined, 2) }}</code></pre>
                                </md-tab>
                            </md-tabs>
                        </div>
                    </div>
                </div>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./AuthWebhookRun.ts"></script>
<style src="./AuthWebhookRun.css" scoped></style>
