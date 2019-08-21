<template>
    <div @focusin="onFocused" @focusout="onNotFocused" ref="editor" class="editor"></div>
</template>
<script src="./MonacoEditor.ts"></script>
<style src="./MonacoEditor.css" scoped></style>
