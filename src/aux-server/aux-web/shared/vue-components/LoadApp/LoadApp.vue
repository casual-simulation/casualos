<template>
    <div>
        <splash-screen
            v-if="!!logoUrl && loadingState && !loadingState.done"
            :logoUrl="logoUrl"
            :logoTitle="logoTitle"
            :title="title"
            :version="version"
        ></splash-screen>
        <loading
            v-if="loadingState && (!logoUrl || loadingState.error)``"
            :status="loadingState.message"
            :progress="loadingState.progress * 100"
            :error="loadingState.error ? loadingState.message : null"
            :errorAction="false"
            :errorTitle="loadingState.title || 'This inst is having trouble loading.'"
            :show="loadingState && !loadingState.done"
            :version="version"
            :logoUrl="logoUrl"
            :logoTitle="logoTitle"
            :title="title"
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
