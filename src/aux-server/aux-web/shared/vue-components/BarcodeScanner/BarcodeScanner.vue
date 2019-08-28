<template>
    <div class="barcode-scanner-container">
        <v-barcode :onDetected="barcodeDetected" :readerTypes="readers"></v-barcode>
    </div>
</template>
<script src="./BarcodeScanner.ts"></script>
<style src="./BarcodeScanner.css" scoped></style>
