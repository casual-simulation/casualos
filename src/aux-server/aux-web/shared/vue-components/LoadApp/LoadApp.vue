<template>
    <div>
        <loading
            v-if="loadingState"
            :status="loadingState.message"
            :progress="loadingState.progress * 100"
            :error="loadingState.error ? loadingState.message : null"
            errorAction="Load Static"
            errorTitle="AUX is having trouble loading."
            :show="loadingState && !loadingState.done"
            :version="version"
            @dismiss="dismissLoading()"
        >
        </loading>
        <div v-if="!loading">
            <slot></slot>
        </div>
    </div>
</template>
<script src="./LoadApp.ts"></script>
<style scoped src="./LoadApp.css" />
