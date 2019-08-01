<template>
    <div class="console">
        <div class="console-toolbar md-layout">
            <span class="md-layout-item">Console</span>
            <md-field class="md-layout-item">
                <label for="sources">Sources</label>
                <md-select name="sources" v-model="selectedSources" md-dense multiple>
                    <md-option v-for="source in sources" :key="source" :value="source">{{
                        source
                    }}</md-option>
                </md-select>
            </md-field>
            <div class="md-layout-item close-button-container">
                <md-button class="close-button md-dense md-icon-button" @click="close()">
                    <md-icon>close</md-icon>
                </md-button>
            </div>
        </div>
        <div class="messages">
            <console-message
                v-for="(message, index) in filteredMessages"
                :key="index"
                :message="message"
            ></console-message>
        </div>
    </div>
</template>
<script src="./Console.ts"></script>
<style scoped src="./Console.css" />
