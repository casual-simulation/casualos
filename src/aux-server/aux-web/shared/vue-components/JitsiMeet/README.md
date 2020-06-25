# vue-jitsi-meet ![Deploy](https://github.com/mycurelabs/vue-jitsi-meet/workflows/Deploy/badge.svg)

_Forked from https://github.com/mycurelabs/vue-jitsi-meet_

Vue component for Jitsi Meet Web Integration via IFrame.

> **NOTE:** Always refer to the official [Jitsi Meet IFrame API Docs](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe).

# Installation

**YARN**

```bash
$ yarn add @mycure/vue-jitsi-meet
```

**NPM**

```bash
$ npm install @mycure/vue-jitsi-meet
```

# Props

| Prop    | Type   | Description                                                                                                                   |
| ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| domain  | String | The jitsi server domain                                                                                                       |
| options | Object | Jitsi [Options](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe#api--new-jitsimeetexternalapidomain-options) |

# Usage

```vue
<template>
    <vue-jitsi-meet
        ref="jitsiRef"
        domain="meet.jit.si"
        :options="jitsiOptions"
    ></vue-jitsi-meet>
</template>

<script>
import { JitsiMeet } from '@mycure/vue-jitsi-meet';
export default {
    components: {
        VueJitsiMeet: JitsiMeet,
    },
    computed: {
        jitsiOptions() {
            return {
                roomName: 'some-room-name',
                noSSL: false,
                userInfo: {
                    email: 'user@email.com',
                    displayName: '',
                },
                configOverwrite: {
                    enableNoisyMicDetection: false,
                },
                interfaceConfigOverwrite: {
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_WATERMARK_FOR_GUESTS: false,
                    SHOW_CHROME_EXTENSION_BANNER: false,
                },
                onload: this.onIFrameLoad,
            };
        },
    },
    methods: {
        onIFrameLoad() {
            // do stuff
        },
    },
};
</script>
```

# Domain, and Options

This plugin supports all options available in the [Jitsi IFrame API Documentation](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe#api--new-jitsimeetexternalapidomain-options).

**Usage**

Just bind the jitsi option object to the `options` property.

```html
<vue-jitsi-meet domain="meet.jit.si" :options="options" />
```

# Events

**Methods**

> `addEventListener(eventName, handler)`

To create an event, you must specify a `ref` in the JitsiMeet component. This `ref` is required to access the methods in the JitMeet component.

```html
<vue-jitsi-meet ref="jitsiRef" :options="jitsiOptions" />
```

```javascript
...
computed: {
  jitsiOptions () {
    return {
      ...
      onload: this.onIFrameLoad
    };
  },
},
methods: {
  // Setup events after the IFrame onload event
  onIFrameLoad () {
    this.$refs.jitsiRef.addEventListener('participantJoined', this.onParticipantJoined);
  },
  onParticipantJoined (e) {
    // do stuff
  },
}
...
```

# Execute Command

[Commands Documentation](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe#controlling-the-embedded-jitsi-meet-conference);

**Methods**

> `executeCommand(commandName, arg1, arg2, ...args)`

Control the embedded JitsiMeet conference using the `executeCommand` method. Similar to the [events](#events), this can also be achieved using `ref`.

```html
<vue-jitsi-meet ref="jitsiRef" :options="jitsiOptions" />
```

```javascript
...
computed: {
  jitsiOptions () {
    return {
      ...
      onload: this.onIFrameLoad
    };
  },
},
methods: {
  // Execute commands after the IFrame onload event
  // or at any given action by the user.
  onIFrameLoad () {
    // This will load the 'The display name' value using the `displayName` command.
    this.$refs.jitsiRef.executeCommand('displayName', 'The display name');
  },
}
...
```
