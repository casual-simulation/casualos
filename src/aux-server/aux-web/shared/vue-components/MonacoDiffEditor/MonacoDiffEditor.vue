<template>
    <div @focusin="onFocused" @focusout="onNotFocused" ref="editor" class="editor"></div>
</template>
<script src="./MonacoDiffEditor.ts"></script>
<style src="./MonacoDiffEditor.css" scoped></style>
