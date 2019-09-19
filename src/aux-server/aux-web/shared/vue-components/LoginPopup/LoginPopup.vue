<template>
    <div>
        <md-dialog :md-active.sync="show" @md-closed="close()">
            <p>
                Hi!
            </p>
        </md-dialog>
    </div>
</template>
<script src="./LoginPopup.ts"></script>
<style src="./LoginPopup.css" scoped></style>
