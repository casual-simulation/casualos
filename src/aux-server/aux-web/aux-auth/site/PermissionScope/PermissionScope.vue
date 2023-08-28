<template>
    <span>
        <span v-if="isData">
            <span v-if="permission.addresses === true">All Addresses</span>
            <span v-else-if="permission.addresses === false">No Addresses</span>
            <span v-else
                >Addreses matching <code>{{ permission.addresses }}</code></span
            >
        </span>
        <span v-else-if="isFile">
            <span v-if="!permission.maxFileSizeInBytes && !permission.allowedMimeTypes"
                >All Files</span
            >
            <span v-if="permission.maxFileSizeInBytes">
                Files smaller than
                <strong><data-size :sizeInBytes="permission.maxFileSizeInBytes" /></strong>
            </span>
            <span v-if="!permission.maxFileSizeInBytes && !permission.allowedMimeTypes">and</span>
            <span v-if="permission.allowedMimeTypes">
                MIME Types matching:
                <ul>
                    <li v-for="(mimeType, index) in permission.allowedMimeTypes" :key="index">
                        <code>{{ mimeType }}</code>
                    </li>
                </ul>
            </span>
        </span>
        <span v-else-if="isEvent">
            <span v-if="permission.events === true">All Events</span>
            <span v-else-if="permission.events === false">No Events</span>
            <span v-else
                >Events matching <code>{{ permission.events }}</code></span
            >
        </span>
        <span v-else-if="isPolicy">
            <span v-if="permission.policies === true">All Policies</span>
            <span v-else-if="permission.policies === false">No Policies</span>
            <span v-else
                >Policies matching <code>{{ permission.policies }}</code></span
            >
        </span>
        <span v-else-if="isRole">
            <span v-if="permission.roles === true">All Roles</span>
            <span v-else-if="permission.roles === false">No Roles</span>
            <span v-else
                >Roles matching <code>{{ permission.roles }}</code></span
            >

            <span v-if="permission.type === 'role.grant' || permission.type === 'role.revoke'">
                and
                <span v-if="permission.userIds === true">all Users</span>
                <span v-else-if="permission.userIds === false">no Users</span>
                <span v-else>
                    these user IDs:
                    <ul>
                        <li v-for="(userId, index) in permission.userIds" :key="index">
                            <code>{{ userId }}</code>
                        </li>
                    </ul>
                </span>
                and
                <span v-if="permission.instances === true">all Instances</span>
                <span v-else-if="permission.instances === false">no Instances</span>
                <span v-else
                    >instances matching <code>{{ permission.instances }}</code></span
                >

                <span v-if="permission.maxDurationMs">
                    and for
                    <span v-if="permission.maxDurationMs / 1000 / 60 / 60 / 24 / 7 > 0.5"
                        >less than
                        <strong>{{ permission.maxDurationMs / 1000 / 60 / 60 }}</strong> weeks</span
                    >
                    <span v-else-if="permission.maxDurationMs / 1000 / 60 / 60 / 24 > 0.5"
                        >less than
                        <strong>{{ permission.maxDurationMs / 1000 / 60 / 60 }}</strong> days</span
                    >
                    <span v-else-if="permission.maxDurationMs / 1000 / 60 / 60 > 0.5"
                        >less than
                        <strong>{{ permission.maxDurationMs / 1000 / 60 / 60 }}</strong> hours</span
                    >
                    <span v-else-if="permission.maxDurationMs / 1000 / 60 > 0.5"
                        >less than
                        <strong>{{ permission.maxDurationMs / 1000 / 60 }}</strong> minutes</span
                    >
                    <span v-else-if="permission.maxDurationMs / 1000 > 0.5"
                        >less than
                        <strong>{{ permission.maxDurationMs / 1000 }}</strong> seconds</span
                    >
                    <span v-else
                        >less than <strong>{{ permission.maxDurationMs }}</strong> miliseconds</span
                    >
                </span>
            </span>
        </span>
    </span>
</template>
<script src="./PermissionScope.ts"></script>
<style src="./PermissionScope.css" scoped></style>
