<template>
    <div class="areas-list">
        <div class="area">
            <div class="title-container">
                <md-icon>code</md-icon>
                <label>No Repo</label>
            </div>
        </div>
        <div class="area">
            <div class="list-container">
                <md-button class="btn btn-primary" @click="$emit('create-repo')">Init</md-button>
                <md-button class="btn btn-secondary" @click="$emit('open-repo')">Clone</md-button>
            </div>
        </div>
    </div>
</template>
<script src="./DefaultPanel.ts"></script>
