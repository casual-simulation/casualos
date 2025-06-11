<template>
    <div class="webhook-run-container">
        <md-card>
            <md-card-content>
                <div class="info-container">
                    <div class="details">
                        <md-list>
                            <md-list-item>
                                <md-icon>info</md-icon>
                                <span class="md-list-item-text">ID: {{ version.id }}</span>
                            </md-list-item>
                            <md-list-item>
                                <md-icon>info</md-icon>
                                <span class="md-list-item-text"
                                    >Key: {{ formatKey(version.key) }}</span
                                >
                            </md-list-item>
                            <md-list-item>
                                <md-icon>schedule</md-icon>
                                <span class="md-list-item-text"
                                    >Size: <data-size :sizeInBytes="version.sizeInBytes"></data-size
                                ></span>
                            </md-list-item>
                            <md-list-item>
                                <md-icon>schedule</md-icon>
                                <span class="md-list-item-text"
                                    >Created: <relative-time :millis="version.createdAtMs"
                                /></span>
                            </md-list-item>
                            <md-list-item>
                                <md-icon>info</md-icon>
                                <span class="md-list-item-text">SHA-256: {{ version.sha256 }}</span>
                            </md-list-item>
                        </md-list>

                        <div v-if="version.description">
                            <h4>Description</h4>
                            <p>{{ version.description }}</p>
                        </div>
                    </div>
                </div>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./AuthPackageVersion.ts"></script>
<style src="./AuthPackageVersion.css" scoped></style>
