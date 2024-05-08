<template>
    <div class="code-of-conduct-container">
        <md-card>
            <md-card-header>
                <h1 class="md-title">{{ hostname }} Code of Conduct</h1>
            </md-card-header>
            <md-card-content>
                <div v-html="codeOfConductHtml"></div>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./AuthCodeOfConduct.ts"></script>
<style src="./AuthCodeOfConduct.css" scoped></style>
