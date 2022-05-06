# CasualOS Changelog

## V3.0.10

#### Date: 5/6/2022

### :rocket: Improvements

-   Improved the Records API to be able to return errors to allowed HTTP origins.
-   Improved `os.meetCommand()` to return a promise.
-   Added the ability to specify an options object with `os.recordData(key, address, data, options)` that can specify update and delete policies for the data.

    -   These policies can be useful to restrict the set of users that can manipulate the recorded data.
    -   `options` is an object with the following properties:

        ```typescript
        let options: {
            /**
             * The HTTP Endpoint that should be queried.
             */
            endpoint?: string;

            /**
             * The policy that should be used for updating the record.
             * - true indicates that the value can be updated by anyone.
             * - An array of strings indicates the list of user IDs that are allowed to update the data.
             */
            updatePolicy?: true | string[];

            /**
             * The policy that should be used for deleting the record.
             * - true indicates that the value can be erased by anyone.
             * - An array of strings indicates the list of user IDs that are allowed to delete the data.
             * Note that even if a delete policy is used, the owner of the record can still erase any data in the record.
             */
            deletePolicy?: true | string[];
        };
        ```

-   Added the `os.tip(message, pixelX?, pixelY?, duration?)` and `os.hideTips(tipIDs?)` functions to make showing tooltips easy.
    -   `os.tip(message, pixelX?, pixelY?, duration?)` can be used to show a tooltip and takes the following parameters:
        -   `message` is the message that should be shown.
        -   `pixelX` is optional and is the horizontal pixel position on the screen that the message should be shown at.
            If omitted, then the tooltip will be shown at the current mouse position or the last touch position.
            Additionally, omitting the position will cause the tooltip to only be shown when the mouse is near it.
            Moving the mouse away from the tooltip in this mode will cause the tooltip to be automatically hidden.
        -   `pixelY` is optional and is the vertical pixel position on the screen that the message should be shown at.
            If omitted, then the tooltip will be shown at the current mouse position or the last touch position.
            Additionally, omitting the position will cause the tooltip to only be shown when the mouse is near it.
            Moving the mouse away from the tooltip in this mode will cause the tooltip to be automatically hidden.
        -   `duration` is optional and is the number of seconds that the toast should be visible for.
        -   Returns a promise that resolves with the ID of the newly created tooltip.
    -   `os.hideTips(tipIDs?)` can be used to hide a tooltip and takes the following parameters:
        -   `tipIDs` is optional and is the ID or array of IDs of tooltips that should be hidden. If omitted, then all tooltips will be hidden.
        -   Returns a promise that resolves when the action has been completed.
-   Improved the menuPortal to use 60% of the screen width on large screens when the screen is taller than it is wide.
-   Improved the systemPortal to support `system` tag values that are set to non-string values such as booleans and integers.
-   Added WebXR hand tracking support.
    -   Tested and verified on Meta Quest 2 headset.
    -   Wrist portals have custom offsets for hands to try and minimize the blocking of hands during interaction.
    -   Air tap interaction only currently. Air taps are when you tap your index finger and thumb together to perform a "tap/click" on what the pointer ray is targeting.

### :bug: Bug Fixes

-   Fixed an issue where CasualOS would attempt to download records from the wrong origin if using a custom `endpoint` parameter.

## V3.0.9

#### Date: 4/27/2022

### :rocket: Improvements

-   Added the `crypto.hash(algorithm, format, ...data)` and `crypto.hmac(algorithm, format, key, ...data)` functions.
    -   These functions make it easy to generalize which hash algorithm to use and also support outputting the result in several different formats.
    -   Supported algorithms for `crypto.hash()` are: `sha256`, `sha512`, and `sha1`.
    -   Supported algorithms for `crypto.hmac()` are: `hmac-sha256`, `hmac-sha512`, and `hmac-sha1`.
    -   Supported formats for both are: `hex`, `base64`, and `raw`.
    -   See the documentation for more information.
-   Added the `bytes.toBase64String(bytes)`, `bytes.fromBase64String(base64)`, `bytes.toHexString(bytes)`, and `bytes.fromHexString(hex)` functions.
    -   These functions make it easy to convert to and from Base64 and Hexadecimal encoded strings to [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) byte arrays.
    -   See the documentation for more information.

### :bug: Bug Fixes

-   Fixed a permissions issue that prevented the creation of subjectless keys.

## V3.0.8

#### Date: 4/26/2022

### :rocket: Improvements

-   Added the ability to view participants and breakout rooms in the meetPortal.

## V3.0.7

#### Date: 4/26/2022

### :bug: Bug Fixes

-   Fixed an issue where bot labels would not render.

## V3.0.6

#### Date: 4/26/2022

### :bug: Bug Fixes

-   Fixed an issue where bots would not render because their shader code was broken.

## V3.0.5

#### Date: 4/26/2022

### :rocket: Improvements

-   Added the ability to specify which auth site records should be loaded/retrieved from.
    -   This is useful for saving or getting records from another CasualOS instance.
    -   The following functions have been updated to support an optional `endpoint` parameter:
        -   `os.recordData(key, address, data, endpoint?)`
        -   `os.getData(recordName, address, endpoint?)`
        -   `os.listData(recordName, startingAddress?, endpoint?)`
        -   `os.eraseData(key, address, endpoint?)`
        -   `os.recordManualApprovalData(key, address, data, endpoint?)`
        -   `os.getManualApprovalData(recordName, address, endpoint?)`
        -   `os.listManualApprovalData(recordName, startingAddress?, endpoint?)`
        -   `os.eraseManualApprovalData(key, address, endpoint?)`
        -   `os.recordFile(key, data, options?, endpoint?)`
        -   `os.eraseFile(key, url, endpoint?)`
        -   `os.recordEvent(key, eventName, endpoint?)`
        -   `os.countEvents(recordName, eventName, endpoint?)`
-   Improved the sheetPortal and and multi-line editor to support editing tags that contain object values.
-   Updated the Terms of Service, Acceptable Use Policy, and Privacy Policy to make it clearer which websites they apply to.
-   Improved how lines are rendered to use an implementation built into three.js.
    -   This makes bot strokes that are scaled appear correct.
    -   This change also makes lines and strokes appear the same size on screen no matter the zoom level of the camera. This can make it easier to identify bots when zoomed out a lot.
-   Added the ability to allow/deny login with phone numbers based on regex rules defined in a DynamoDB table.
-   Added the `os.getSubjectlessPublicRecordKey(recordName)` function to make it possible to create a record key that allow publishing record data without being logged in.
    -   All record keys are now split into two categories: subjectfull keys and subjectless keys.
    -   subjectfull keys require login in order to publish data are are the default type of key.
    -   subjectless keys do not require login in order to publish data.
    -   When publishing data with a subjectless key, all users are treated as anonymous. In effect, this makes the owner of the record fully responsible for the content that they publish.
-   Added the `os.meetFunction(functionName, ...args)` function to allow querying the current meet portal meeting state.
    -   `functionName` is the name of the function that should be triggered from the [Jitsi Meet API](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe/#functions).
    -   `args` is the list of arguments that should be provided to the function.
    -   Returns a promise that resolves with the result of the function call.
-   Added the `@onMeetEntered` and `@onMeetExited` shouts which are triggered whenever the current user starts/stops participating in a meet.
    -   Unlike `@onMeetLoaded`, `@onMeetEntered` is only triggered after the user clicks the "Join" button from the meeting waiting room.
    -   See the documentation for more detailed information.
-   Added the `meetPortalJWT` tag to the meetPortalBot to allow using JSON Web Tokens for authenticating moderators in meetings.
    -   See the Jitsi FAQ for more information on how to setup a moderator for a meeting: https://developer.8x8.com/jaas/docs/faq#how-can-i-set-a-user-as-moderator-for-a-meeting
-   Added the `botPortal` tag that when set to a bot ID on the `configBot` will show the JSON data for that bot.
    -   Additionally, the `botPortalAnchorPoint` and `botPortalStyle` tags can be set on the `botPortalBot` similarly to how `meetPortalAnchorPoint` can be set on the `meetPortalBot`.
-   Added the `systemTagName` tag that, when set on the config bot, specifies the tag that should be used when finding bots to include in the systemPortal.
    -   For example, setting `systemTagName` to `"test"` will cause the systemPortal to search for bots that have a `test` tag instead of a `system` tag.

### :bug: Bug Fixes

-   Fixed an issue where accessing certain properties on `globalThis` would cause an error to occur.
-   Fixed an issue where it was not possible to change the current meetPortal while it was already open.
-   Fixed an issue where using `os.replaceDragBot()` with bots that contained an array in its tags would cause an error.
-   Fixed an issue where videos in `formAddress` would not automatically play on Chrome web browsers.

## V3.0.4

#### Date: 3/31/2022

### :rocket: Improvements

-   Added the ability to force AUX to intepret values as strings by prefixing the tag value with the 📝 emoji.
    -   This can be useful for when you want to ensure that a tag value is interpreted a string.
    -   For example, the string `"01"` will be interpreted as the number `1` by default but `"📝01"` will preserve the leading 0.
-   Added the ability to force a tag to interpret values as numbers by prefixing the tag value with the 🔢 emoji.
    -   This can be useful when you want to ensure that a tag is interpreted as a number.
-   Added support for scientific notation in numbers.
    -   `1.23e3` will now be interpreted as `1230`.
-   Improved `os.focusOn()` to support positions that include a Z coordinate.
    -   This allows moving the camera focus point to any position in 3D space.
    -   The Z coordinate defaults to 0 if not specified.
-   Added the `menuItemShowSubmitWhenEmpty` tag to allow showing the submit button on input menu items even if the input box does not have any value.
-   Added the `os.addDropGrid(...grids)` and `os.addBotDropGrid(botId, ...grids)` functions to make it easy to snap bots to a custom grid.
    -   These functions are useful if you want to snap bots to a grid with a custom position or rotation.
    -   Additionally, they can be used to move bots in a grid that is attached to a portal bot.
    -   See the documentation for detailed usage information.

### :bug: Bug Fixes

-   Fixed an issue where `infinity` and `-infinity` would always be calculated as `NaN` instead of their corresponding numerical values.
-   Fixed an issue where passing `null`/`undefined`/`NaN`/`Infinity` as the `x` or `y` coordinate to `os.focusOn()` would break the gridPortal.
-   Fixed an issue where error stack traces would sometimes contain incorrect line numbers.
-   Fixed an issue where the systemPortal recent tags list could error if a bot without a system tag was edited.
-   Fixed an issue where the runtime would crash if `animateTag()` was given a null bot.
-   Fixed an issue where dragging a bot with a controller in free space would position the bot incorrectly if the bot was loaded by a portal form bot.
-   Fixed an issue where bots that were inside a bot portal that was inside a wrist portal would have an incorrect scale. ([#254](https://github.com/casual-simulation/casualos/issues/254))

## V3.0.3

#### Date: 3/22/2022

### :rocket: Improvements

-   Added the `os.getAverageFrameRate()` function.
    -   This function is useful for calculating the number of times that the 3D views have updated in the last second.
    -   Returns a promise that resolves with the current frame rate value.
-   `AUX_PLAYER_MODE`: The player mode that this instance should indicate to scripts.
    -   `"player"` indicates that the inst is supposed to be for playing AUXes while `"builder"` indicates that the inst is used for building AUXes.
    -   Defaults to `"builder"`.
    -   This value is exposed via the object returned from `os.version()`.
        -   See the documentation on `os.version()` for more information.
-   Added a button that offers to redirect to a static instance after a 25 second loading timeout.
    -   The redirect will send the user to `static.{common_host}` so `casualos.com` will redirect to `static.casualos.com` and `stable.casualos.com` will redirect to `static.casualos.com`.

## V3.0.2

#### Date: 3/16/2022

### :boom: Breaking Changes

-   Removed the following functions:
    -   `server.exportGpio()`
    -   `server.unexportGpio()`
    -   `server.getGpio()`
    -   `server.setGpio()`

### :rocket: Improvements

-   Improved performance for lower end devices by making CasualOS more efficient when automatically updating bots with user input.
-   Added the ability to login with a phone number instead of an email address.
    -   This feature is enabled by the `ENABLE_SMS_AUTHENTICATION` environment variable during builds.
-   Added the ability to automatically synchronize device clocks and expose the synchronized information to scripts.
    -   The following properties have been added:
        -   `os.localTime` - The local clock time in miliseconds since the Unix Epoch.
        -   `os.agreedUponTime` - The synchronized clock time in miliseconds since the Unix Epoch.
        -   `os.instLatency` - The average latency between this device and the inst in miliseconds. Smaller values are generally better.
        -   `os.instTimeOffset` - The delta between the local time and agreed upon time in miliseconds.
        -   `os.instTimeOffsetSpread` - The uncertainty of the accuracy of the `os.instTimeOffset` value. Measured in miliseconds. Smaller values indicate that `os.agreedUponTime` is more accurate, larger values indicate that `os.agreedUponTime` is less accurate.
        -   `os.deadReckoningTime` - The synchronized clock time that includes an additional 50ms offset to try to ensure that all devices are synchronized once the time ocurrs.
-   Improved `animateTag()` to support custom easing functions and a custom start time.
    -   The `easing` property in the options object that is passed to `animateTag()` now supports custom functions for custom easing behaviors. The function should accept one parameter which is a number between 0 and 1 that represents the progress of the animation and it should return a number which is the value that should be multiplied against the target tag. See the documentation of `animateTag()` for an example.
    -   The `startTime` property is now supported in the options object that is passed to `animateTag()`. It should be the number of miliseconds since the Unix Epoch that the animation should start at. For example, `os.localTime + 1000` will cause the animation to start in 1 second.

### :bug: Bug Fixes

-   Fixed an issue where `bot.vars` would get cleared after the scripts that created it finished their initial execution.
-   Fixed an issue where `labelColor` did not work on menu bots that had `form` set to `input`.
-   Fixed an issue where `labelColor` would not work unless the menu bot had a `label`.
    -   This is useful for menu bots that only use icons.

## V3.0.1

#### Date: 2/17/2022

### :rocket: Improvements

-   Added the `math.setRandomSeed(seed)` and `math.getSeededRandomNumberGenerator(seed?)` functions.

    -   `math.setRandomSeed(seed)` specifies the random seed that should be used for `math.random()` and `math.randomInt()`.
        -   `seed` is the number or string that should be used as the random number generator seed. If set to null, then the seed value will be cleared.
    -   `math.getSeededRandomNumberGenerator(seed?)` creates a new object that contains its own `random()` and `randomInt()` functions that use the specified seed.

        -   `seed` is the number of string that should be used the random number generator seed. If omitted, then an unpredictable seed will be chosen automatically.
        -   It returns an object with the following structure:

            ```typescript
            let result: {
                /**
                 * The seed that was used to create this random number generator.
                 */
                seed: number | string;

                /**
                 * Generates a random real number between the given minimum and maximum values.
                 */
                random(min?: number, max?: number): number;

                /**
                 * Generates a random integer between the given minimum and maximum values.
                 */
                randomInt(min: number, max: number): number;
            };
            ```

-   Added the ability to store dates in tags by prefixing them with `📅`.
    -   Dates must be formatted similarly to [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601):
        -   `2012-02-06` (year-month-day in UTC-0 time zone)
        -   `2015-08-16T08:45:00` (year-month-day + hour:minute:second in UTC-0 time zone)
        -   `2015-08-16T08:45:00 America/New_York` (year-month-day + hour:minute:second in specified time zone)
        -   `2015-08-16T08:45:00 local` (year-month-day + hour:minute:second + in local time zone)
    -   In scripts, date tags are automatically parsed and converted to DateTime objects.
        -   DateTime objects are easy-to-use representations of date and time with respect to a specific time zone.
        -   They work better than the built-in [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) class because DateTime supports time zones whereas Date does not.
        -   You can learn more about them by checking out the [documentation](https://docs.casualos.com/docs/actions#datetime).
-   Added the `getDateTime(value)` function to make parsing strings into DateTime objects easy.
    -   Parses the given value and returns a new DateTime that represents the date that was contained in the value.
    -   Returns null if the value could not be parsed.
-   Added the `circle` bot form.

## V3.0.0

#### Date: 2/10/2022

### :rocket: Improvements

-   Added the `os.openImageClassifier(options)` and `os.closeImageClassifier()` functions.
    -   These functions are useful for applying Machine Learning inside CasualOS to detect categories of things via the camera feed.
    -   Currently, the image classifier is only able to consume models generated with [Teachable Machine](https://teachablemachine.withgoogle.com/).
        1.  To create a model, go to [https://teachablemachine.withgoogle.com/](https://teachablemachine.withgoogle.com/) and click "Get Started".
        2.  Create an "Image Project" and choose "Standard image model".
        3.  Add or record photos in each class.
        4.  Click "Train".
        5.  Once training is done you can get a model URL by clicking "Export Model".
        6.  Under "Tensorflow.js", choose "Upload (shareable link)" and click "Upload". You can also optionally save the project to Google Drive.
        7.  Once uploaded, copy the shareable link.
        8.  Create a bot with an `@onClick` tag and put the following code in it (replacing `MY_MODEL_URL` with the shareable link):
            ```typescript
            await os.openImageClassifier({
                modelUrl: 'MY_MODEL_URL',
            });
            ```
    -   `options` is an object with the following properties:
        -   `modelUrl` - The sharable link that was generated from Teachable Machine.
        -   `modelJsonUrl` - Is optional and can be used in advanced scenarios where you want to control where the model is stored.
        -   `modelMetadataUrl` - Is optional and can be used in advanced scenarios where you want to control where the model is stored.
        -   `cameraType` - Is optional and is the type of camera that should be preferred. Can be "front" or "rear".
-   Created the `oai-1` appBundle.

    -   This appBundle is currently a simple ab that can query the [OpenAI GPT-3 API](https://beta.openai.com/overview) via a shout.
    -   The ab has the following features:

        -   A single manager bot in the `oai-1` dimension and systemPortal as `oai-1.manager`.
        -   `@generateTextResponse` is a listener that asks GPT-3 to respond to a given text prompt.

            -   It takes the following parameters:
                -   `apiKey` - The API key that should be used to access the API. You can get an API key at [https://beta.openai.com/overview](https://beta.openai.com/overview).
                -   `prompt` - The text that the AI should respond to. An example is "Write a tagline for an ice cream shop.". Also see this guide: [https://beta.openai.com/docs/guides/completion](https://beta.openai.com/docs/guides/completion).
                -   `engine` - The engine that should be used to process the prompt. Defaults to `"text-davinci-001"` if not specified. You can find a list of engines is available here: [https://beta.openai.com/docs/engines](https://beta.openai.com/docs/engines).
                -   `options` - An object that contains additional options for the request. You can find the documentation for these options here: [https://beta.openai.com/docs/api-reference/completions/create](https://beta.openai.com/docs/api-reference/completions/create).
            -   It returns a promise that contains a list of generated choices.
            -   Example:

                ```typescript
                let oai = getBot('system', 'oai-1.manager');
                const response = await oai.generateTextResponse({
                    apiKey: 'myAPIKey',
                    prompt: 'Write a tagline for an ice cream shop.',
                });

                if (response.choices.length > 0) {
                    os.toast('Best choice: ' + response.choices[0]);
                } else {
                    os.toast('No choices.');
                }
                ```

### :bug: Bug Fixes

-   Fixed an issue with `os.listData()` where it was impossible to list data items unless a starting address was provided.

## V2.0.36

#### Date: 2/4/2022

### :rocket: Improvements

-   Added global search to the systemPortal.
    -   Useful for finding a word or phrase in the tags of all the bots in an inst.
    -   For example, you can find all the places where a shout occurrs by typing "shout" into the search box.
    -   Can be accessed by using `Ctrl+Shift+F` while the systemPortal is open or by selecting the eyeglass icon on the left side of the screen.
-   Added the ability to use a video camera feed as the portal background.
    -   You can enable this feature by setting `portalBackgroundAddress` to `casualos://camera-feed`.
    -   It also supports specifying the rear or front facing cameras with `casualos://camera-feed/rear` and `casualos://camera-feed/front`.

### :bug: Bug Fixes

-   Fixed an issue with custom apps where HTML changes would stop propagating if an element was added to its own parent.
    -   This could happen via using the HTML document API like:
        ```typescript
        // in @onSetupApp
        const parent = that.document.createElement('div');
        const child = that.document.createElement('span');
        parent.appendChild(child);
        parent.appendChild(child); // This would cause the issue
        ```
    -   Alternatively, it could happen when using `os.compileApp()`.
        -   For efficiency, `os.compileApp()` uses a change detection algorithm to limit the number of HTML elements it needs to create.
        -   In some cases, it saw that it could reuse an HTML element by moving it and this happened to trigger the bug in the system that records these changes.

## V2.0.35

#### Date: 2/2/2022

### :rocket: Improvements

-   Added the `os.getMediaPermission(options)` function to request permission for device audio/video streams.
    -   Generally permissions are asked for the moment they are needed but this can be cumbersome in situations such as immersive ar/vr experiences as the user must jump back to the browser in order to grant them.

### :bug: Bug Fixes

-   Fixed jittery camera rendering issues when entering XR for the first time in a session.
-   Fixed three.js holding onto stale XRSession after exiting XR.
    -   This was the root cause of the Hololens losing the ability to render the scene background after exiting XR.

## V2.0.34

#### Date: 1/31/2022

### :rocket: Improvements

-   Improved the systemPortal to show all tags that are on the bot when the pinned tags section is closed.
    -   This makes it easier to manage when adding new tags while the pinned tags section is closed.

### :bug: Bug Fixes

-   Fixed an issue with `os.recordEvent()` where trying to save events in DynamoDB would fail.

## V2.0.33

#### Date: 1/31/2022

### :rocket: Improvements

-   Added the `os.listData(recordNameOrKey, startingAddress?)` function to make it easy to list data items in a record.
    -   `recordNameOrKey` is the name of the record. Can also be a record key.
    -   `startingAddress` is optional and is the address after which items will be included in the returned list. For example, the starting address `b` will cause addresses `c` and `d` to be included but not `a` or `b`.
-   Added the `os.recordEvent(recordKey, eventName)` and `os.countEvents(recordNameOrKey, eventName)` functions. These functions are useful for building simple analytics into your app bundles.
    -   `os.recordEvent(recordKey, eventName)` can be used to document that the given event occurred.
        -   `recordKey` is the key that should be used to access the record.
        -   `eventName` is the name of the event.
    -   `os.countEvents(recordNameOrKey, eventName)` can be used to get the number of times that the given event has ocurred.
        -   `recordNameOrKey` is the name of the record that the event count should be retrieved from. Can also be a record key.
        -   `eventName` is the name of the event.

## V2.0.32

#### Date: 1/26/2022

### :rocket: Improvements

-   Added the `os.arSupported()` and `os.vrSupported()` functions to query device support for AR and VR respectively. Both of these are promises and must be awaited.

    ```typescript
    const arSupported = await os.arSupported();
    if (arSupported) {
        //...
    }

    const vrSupported = await os.vrSupported();
    if (vrSupported) {
        //...
    }
    ```

-   Added shouts for entering and exiting AR and VR:
    -   `@onEnterAR` - Called when AR has been enabled.
    -   `@onExitAR` - Called when AR has been disabled.
    -   `@onEnterVR` - Called when VR has been enabled.
    -   `@onExitVR` - Called when VR has been disabled.
-   Expanded `meetPortal` scripting:
    -   Added shouts for loading and leaving the meet portal:
        -   `@onMeetLoaded` - Called when the user has finished loading the meet portal.
        -   `@onMeetLeave` - Called when the user leaves the meet portal.
    -   Added the `os.meetCommand(command, ...args)` function that sends commands directly to the Jitsi Meet API. Supported commands can be found in the [Jitsi Meet Handbook](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe#commands).
    -   Added the following meet portal configuration tags. These must be set on the `meetPortalBot`:
        -   `meetPortalPrejoinEnabled` - Whether the meet portal should have the prejoin screen enabled.
            -   The prejoin screen is where the user can setup their display name, microphone, camera, and other settings, before actually joining the meet.
        -   `meetPortalStartWithVideoMuted` - Whether the meet portal should start with video muted.
        -   `meetPortalStartWithAudioMuted` - Whether the meet portal should start with audio muted.
        -   `meetPortalRequireDisplayName` - Whether the meet portal should require the user define a display name.

## V2.0.31

#### Date: 1/20/2022

### :rocket: Improvements

-   Added the `os.eraseData(recordKey, address)` function to allow deleting data records.
    -   `recordKey` is the key that should be used to access the record.
    -   `address` is the address of the data inside the record that should be deleted.
-   Added the `os.eraseFile(recordKey, urlOrRecordFileResult)` function to allow deleting file records.
    -   `recordKey` is the key that should be used to access the record.
    -   `urlOrRecordFileResult` is the URL that the file is stored at. It can also be the result of a `os.recordFile()` call.
-   Added the `os.recordManualApprovalData(recordKey, address, data)`, `os.getManualApprovalData(recordName, address)`, and `os.eraseManualApprovalData(recordKey, address)` functions.
    -   These work the same as `os.recordData()`, `os.getData()`, and `os.eraseData()` except that they read & write data records that require the user to confirm that they want to read/write the data.
    -   One thing to note is that manual approval data records use a different pool of addresses than normal data records.
        This means that data which is stored using `os.recordManualApprovalData()` cannot be retrieved using `os.getData()` (i.e. you must use `os.getManualApprovalData()`).

### :bug: Bug Fixes

-   Fixed an issue where trying to save a bot using `os.recordData()` or `os.recordFile()` would produce an error.

## V2.0.30

#### Date: 1/14/2022

### :wrench: Plumbing Changes

-   Replaced socket.io with native WebSockets.
    -   The possible options for `CAUSAL_REPO_CONNECTION_PROTOCOL` are now `websocket` and `apiary-aws`.
    -   Since the introduction of `apiary-aws`, we've used native WebSockets for more connections. As such, it should be safe to use native WebSockets in place of socket.io.
    -   This means we have fewer depenencies to keep up with and fewer potential bugs.
    -   Additionally it means that we save a little bit on our output code bundle size.

### :bug: Bug Fixes

-   Fixed an issue where deleting all the text from a menu item would show the `menuItemText` tag value instead of the (empty) `menuItemText` tag mask value.
    -   This change causes CasualOS to use `false` for the `menuItemText` `tempLocal` tag mask when a normal tag value is present for `menuItemText`. If the bot has no tag value for `menuItemText`, then `null` is used.
-   Fixed an issue where CasualOS could sometimes miss events during initialization.
    -   This bug most likely affected portals that are configurable by a config bot (e.g. gridPortal) but could have also affected other parts of the CasualOS system.
    -   This bug also was very rare. We only saw it once in our testing.
-   Fixed an issue with custom apps where calling `os.registerApp()` multiple times would cause the app to be destroyed and re-created.
    -   This caused issues with retaining focus and made the user experience generally poor.
-   Fixed an issue with custom apps where a the value attribute could not be overridden on input elements.
    -   Now it is possible to specify what the value should be and it will be properly synced.

## V2.0.29

#### Date: 1/10/2022

### :rocket: Improvements

-   Added the ability to use videos for `formAddress` and `portalBackgroundAddress` URLs.
-   Improved CasualOS to support logging into ab1.link directly from CasualOS.
    -   Previously you would have to login to ab1.link via a new tab.
    -   The new experience is seamless and much less confusing.

### :bug: Bug Fixes

-   Fixed an issue where DRACO compressed GLTF models could not be loaded if the decoder program had already been cached by the web browser.

## V2.0.28

#### Date: 1/5/2022

### :boom: Breaking Changes

-   Changed the auth and records features to default to disabled unless the the `AUTH_ORIGIN` and `RECORDS_ORIGIN` environment variables are specified during build.

### :rocket: Improvements

-   Added the `links` global variable to the code editor autocomplete list.
-   Added the `masks` global variable to the code editor autocomplete list.
-   Improved `os.showUploadFiles()` to include the `mimeType` of the files that were uploaded.
    -   This makes it easier to upload files with `os.recordFile()`.
-   Added the `os.beginAudioRecording(options?)` and `os.endAudioRecording()` functions.
    -   They replace the `experiment.beginAudioRecording()` and `experiment.endAudioRecording()` functions.
    -   Additionally, they now trigger the following listeners:
        -   `@onBeginAudioRecording` - Called when recording starts.
        -   `@onEndAudioRecording` - Called when recording ends.
        -   `@onAudioChunk` - Called when a piece of audio is available if streaming is enabled via the options.
    -   `options` is an object and supports the following properties:
        -   `stream` - Whether to stream audio samples using `@onAudioChunk`.
        -   `mimeType` - The MIME type that should be used to stream audio.
        -   `sampleRate` - The number of audio samples that should be taken per second (Hz). Only supported on raw audio types (`audio/x-raw`).
    -   See the documentation for more information and examples.

### Bug Fixes

-   Fixed an issue where the "remove tag" (X) buttons on empty tags in the sheet portal were always hidden.

## V2.0.27

#### Date: 1/4/2022

### :bug: Bug Fixes

-   Fixed another issue where file records could not be uploaded due more issues with signature calculations.

## V2.0.26

#### Date: 1/4/2022

### :bug: Bug Fixes

-   Fixed another issue where file records could not be uploaded due to various permissions issues.

## V2.0.25

#### Date: 1/4/2022

### :bug: Bug Fixes

-   Fixed an issue where file records could not be uploaded due to not including a security token in a request.

## V2.0.24

#### Date: 1/4/2022

### :bug: Bug Fixes

-   Fixed an issue where file records could not be uploaded due to a permissions issue.

## V2.0.23

#### Date: 1/4/2022

### :bug: Bug Fixes

-   Fixed an issue where file records could not be uploaded due to an issue with signature calculation.

## V2.0.22

#### Date: 1/3/2022

### :boom: Breaking Changes

-   Removed the following functions:
    -   `os.publishRecord()`
    -   `os.getRecords()`
    -   `os.destroyRecord()`
    -   `byAuthID()`
    -   `withAuthToken()`
    -   `byAddress()`
    -   `byPrefix()`

### :rocket: Improvements

-   Implemented the next version of records.
    -   This version replaces the old API (`os.publishRecord()`) and introduces a new paradigm.
    -   The first major change is that records now represent multiple pieces of data.
    -   `os.getPublicRecordKey(recordName)` has been added as a way to retrieve a key that can be used to write data and files to a public record.
    -   `os.recordData(recordKey, address, data)` can be used to store a piece of data at an address inside a record. This data can later be retrieved with `os.getData(recordKeyOrName, address)`.
    -   `os.getData(recordKeyOrName, address)` can be used to retrieve data that was stored in a record.
    -   `os.recordFile(recordKey, data, options?)` can be used to store a file inside a record. Files can be any size and can be accessed via `webhook()` or `os.getFile(url)`.
    -   `os.getFile(urlOrRecordFileResult)` can be used to easily retrieve a file.
    -   `os.isRecordKey(value)` is useful for determining if a value represents a record key.
    -   See the documentation for more information.
-   Updated Material Icons to the latest publicly available version.

## V2.0.21

#### Date: 12/6/2021

### :rocket: Improvements

-   Added [Simple Analytics](https://simpleanalytics.com/) to help us better understand how many people are using CasualOS.
-   Added the `os.convertGeolocationToWhat3Words(location)` function.

    -   Useful for getting a 3 word address for a latitude & longitude location.
    -   Returns a promise that resolves with the string containing the 3 words.
    -   `location` is an object with the following structure:

        -   ```typescript
            let location: {
                /**
                 * The latitude of the location.
                 */
                latitude: number;

                /**
                 * The longitude of the location.
                 */
                longitude: number;

                /**
                 * The language that the resulting 3 word address should be returned in.
                 * Defaults to "en".
                 * See https://developer.what3words.com/public-api/docs#available-languages
                 * for a list of available languages.
                 */
                language?: string;
            };
            ```

## V2.0.20

#### Date: 12/2/2021

### :bug: Bug Fixes

-   Fixed an issue where removing a bot without a stroke from a dimension would cause CasualOS to stop responding.

## V2.0.19

#### Date: 12/1/2021

### :boom: Breaking Changes

-   `lineStyle` now defaults to `line` instead of `arrow`.

### :rocket: Improvements

-   Updated the CasualOS Terms of Service.
-   Improved `lineTo` and `strokeColor` to use lines that support custom widths.
-   Added the `links` variable as a shortcut for `thisBot.links`.
-   Added `bot.vars` and `os.vars` as an easy way to store and lookup variables by name.
    -   `os.vars` works exactly the same as `globalThis`.
    -   `bot.vars` allows you to store special values in a bot that cannot be stored in either `bot.tags` or `bot.masks`.
-   Added the ability to whisper to a bot by using `bot.listener()` instead of `whisper(bot, "listener")`.
    -   e.g.
        ```typescript
        let result = thisBot.myScript(argument);
        ```
        is equivalent to
        ```typescript
        let [result] = whisper(thisBot, 'myScript', argument);
        ```
-   Added the ability to shout to bots by using `shout.listener()` instead of `shout("listener")`.
    -   e.g.
        ```typescript
        let results = shout.myScript(argument);
        ```
        is equivalent to
        ```typescript
        let results = shout('myScript', argument);
        ```

## V2.0.18

#### Date: 11/30/2021

### :rocket: Improvements

-   Added bot links.
    -   Bot links are special tag values that represent a link from the tag to another bot.
    -   Similarly to listen tags, you can create a bot link by setting a tag to `🔗{botID}`.
    -   The 🔗 emoji tells CasualOS that the tag represents a link to another bot.
    -   Links work by referencing Bot IDs and CasualOS now provides additional functions to help with understanding bot links.
        For example, not only do the `#lineTo`, `#creator` and `#transformer` tags support bot links, but you can find the list of tags that reference other bots by using the new `getBotLinks(bot)` function.
    -   Bot links also support linking to multiple other bots by adding commas in between Bot IDs.
    -   The `bot.link` property has been added as a way to quickly get a link to the bot.
    -   The `bot.links` property has been added for scripts to interface with bot links.
        -   This property represents the tags that are bot links.
        -   You can easily link to a bot by setting
            ```typescript
            bot.links.tag = botToLinkTo;
            ```
        -   You can also get the bot(s) that are linked by using
            ```typescript
            // Gets a single bot if only one bot is linked in the tag.
            // Gets an array if multiple bots are linked.
            let linkedBot = bot.links.tag;
            ```
    -   Additionally, the `byTag()` bot filter has been updated to support searching for bots by link.
        -   For example if the `#myLink` tag is used to link bots,
            you can find all the bots that link to this bot using `#myLink` by using `byTag()` like this:
            ```typescript
            let botsThatLinkToThisBot = getBots(
                byTag('myLink', '🔗' + thisBot.id)
            );
            ```
        -   This change also means that it is now possible to have multiple creators for a bot by using bot links in the `#creator` tag.
-   Added some minor visual improvements to the systemPortal.
-   Improved menu bots to show their `formAddress` icon when the bot has no label.
-   Added the `os.getExecutingDebugger()` function.
    -   Gets the debugger that this script is currently running inside. Returns null if not running inside a debugger.
-   Added the `getFormattedJSON(data)` function.
    -   Works like `getJSON(data)` except the returned JSON is nicely formatted instead of compressed.
-   Added the `getSnapshot(bots)` function.
    -   Snapshots are like mods except they represent multiple bots and include the ID, space, tags, and tag masks of each bot.
    -   They are useful for debugging and easily saving a bunch of bots at once.
-   Added the `diffSnapshots(first, second)` function.
    -   Useful for calculating the delta between two snapshots.
-   Added the `applyDiffToSnapshot(snapshot, diff)` funciton/
    -   Useful for calculating a new snapshot from a snapshot and a delta.
    -   Works kinda like the opposite of `diffSnapshots(first, second)`.
-   Added the `getLink(...bots)` function.
    -   Creates a value that represents a link to the given bots. You can then save this value to a tag to save the link.
-   Added the `getBotLinks(bot)` function.
    -   Useful for discovering what links a bot has stored.
    -   See the documentation for more detailed info.
-   Added the `updateBotLinks(bot, idMap)` function.
    -   Useful for updating bot links to reference new bots.
    -   See the documentation for more detailed info.
-   Improved the `editingBot` tag to use bot links instead of just storing the bot ID.
-   Added the `pixelRatio` and `defaultPixelRatio` tags to the configBot.
    -   `defaultPixelRatio` is the [pixel ratio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) that is used by CasualOS for rendering 3D portals by default.
    -   `pixelRatio` can be set on the configBot to control the size of the internal render buffers. Higher values make the output image appear smoother but will also cause CasualOS to run slower.
-   Improved `web.hook()` and related functions to accept the `retryCount`, `retryStatusCodes`, and `retryAfterMs` options.
    -   `retryCount` is the number of times the request should be re-sent if it fails. Defaults to 0.
    -   `retryStatusCodes` is the array of error status codes that should cause the request to be retried. Defaults to:
        -   408 - Request Timeout
        -   429 - Too Many Requests
        -   500 - Internal Server Error
        -   502 - Bad Gateway
        -   503 - Service Unavailable
        -   504 - Gateway Timeout
        -   0 - Network Failure / CORS
    -   `retryAfterMs` is the number of miliseconds to wait between retried requests. Defaults to 3000.

### :bug: Bug Fixes

-   Fixed an issue where deleting a tag in the multiline editor would cause the tag to remain in the data.
-   Fixed an issue where autocomplete for tags did not work in the systemPortal.
-   Fixed some display issues in the systemPortal.
-   Fixed an issue where using loops after JSX elements might cause the script to fail to compile.

## V2.0.17

#### Date: 11/12/2021

### :bug: Bug Fixes

-   Fixed an issue where built-in portal bots were not being updated by CasualOS.
    -   This also fixes an issue where camera position and rotation offsets didn't work.

## V2.0.16

#### Date: 11/11/2021

### :boom: Breaking Changes

-   Removed Custom Executables.
    -   This means the following functions are no longer available:
        -   `os.registerExecutable()`
        -   `os.buildExecutable()`
    -   If you have use for this type of functionality, we recommend that you look into [Custom Apps](https://docs.casualos.com/docs/actions/#app-actions).
        They are easier to use and allow you to use more built-in CasualOS functionality than Custom Executables.

### :rocket: Improvements

-   Added the `systemPortal`.
    -   The systemPortal is a new way to organize and edit a set of bots and their scripts.
    -   The systemPortal works by displaying bots that have a `#system` tag.
    -   When `#systemPortal` on the `configBot` is set to `true`, all bots that have a `#system` tag will be displayed in the system portal.
    -   When `#systemPortal` is set to a string, then only bots where their `#system` tag contains the value in `#systemPortal` will be shown.
    -   It also contains some other useful features not found in the sheetPortal like a list of recently edited tags and a search box that lets you easily change the `#systemPortal` tag value.
    -   See the glossary page on the `systemPortal` for more info.

### :bug: Bug Fixes

-   Fixed an issue where the forward/back browser buttons would not delete tags from the config bot if the related query parameter was deleted.

## V2.0.15

#### Date: 11/1/2021

### :rocket: Improvements

-   Added the `miniMapPortal`.
    -   This is a mini version of the `mapPortal` that works kinda like the `miniGridPortal`.
-   Added a introductory page to the documentation that links to the "Pillars of Casual Simulation" video tutorials.
-   Added a "Getting Started" page that contains some written documentation on the basics of CasualOS.
    -   Thanks to Shane Thornton ([@shane-cpu](https://github.com/shane-cpu)) for contributing this!
-   Added a glossary page to the documentation.
    -   This page is incomplete but contains basic descriptions for common terms like "bot", "tag", "portal", "inst", etc.
    -   There is also a feature where other parts of the documentation can link to the glossary and get Wikipedia-style tooltips for the terms.

### :bug: Bug Fixes

-   Fixed an issue where the server failed to retrieve permanent records when when `.getMoreRecords()` was called.

## V2.0.14

#### Date: 10/29/2021

### :rocket: Improvements

-   Improved the `local` space to delete the oldest inst when localStorage is full.
-   Added the `pointerPixelX` and `pointerPixelY` tags to the gridPortalBot to track the mouse pointer position on the screen.
-   Improved the records system to be able to store records larger than 300KB in size.
    -   Records larger than 300KB will be placed in an S3 bucket.
    -   Records stored in S3 will now have a `dataURL` instead of `data` that points to where the record can be downloaded from.

### :bug: Bug Fixes

-   Fixed an issue where the built-in portal bots would cause all scripts to be recompiled.
-   Fixed an issue where functions that retrieve data from portal bots (like `os.getFocusPoint()`) would always return null data.
-   Fixed an issue where the `.getMoreRecords()` function did not work.

## V2.0.13

#### Date: 10/19/2021

### :rocket: Improvements

-   Added several features to make testing asynchronous scripts easier.
    -   Debuggers now automatically convert asynchronous scripts to synchronous scripts by default.
        -   This makes testing easier because your test code no longer needs to be aware of if a script runs asynchronously in order to observe errors or results.
        -   You can override this default behavior by setting `allowAsynchronousScripts` to `true` in the options object that is passed to `os.createDebugger()`.
    -   Some functions are now "maskable".
        -   Maskable functions are useful for testing and debugging because they let you modify how a function works simply by using `function.mask().returns()` instead of `function()`.
            -   For example, the `web.get()` function sends an actual web request based on the options that you give it. When testing we don't want to send a real web request (since that takes time and can fail), so instead we can mask it with the following code:
            ```typescript
            web.get.mask('https://example.com').returns({
                status: 200,
                data: 'hello world!',
            });
            ```
            Then, the next time we call `web.get()` with `https://example.com` it will return the value we have set:
            ```typescript
            console.log(web.get('https://example.com));
            ```
        -   Maskable functions currently only work when scripts are running inside a debugger with `allowAsychronousScripts` set to `false`.
        -   Here is a list of maskable functions (more are coming):
            -   `web.get()`
            -   `web.post()`
            -   `web.hook()`
            -   `webhook()`
            -   `webhook.post()`
            -   `os.showInput()`
            -   `os.getRecords()`
            -   `os.publishRecord()`
            -   `os.destroyRecord()`
            -   `os.requestPermanentAuthToken()`
    -   Properties added to `globalThis` are now separated per-debugger.
        -   This means that you can set `globalThis.myVariable = 123;` and it won't affect debuggers.
        -   It also means that testing with global variables are easier because you don't have to set and reset them before each test anymore.
    -   Debuggers now automatically setup `tempLocal` bots for built-in portals.
        -   This means that the portal bots like `gridPortalBot`, `mapPortalBot`, etc. are available in debuggers.
    -   Debuggers now automatically setup a `configBot`.
        -   You can override this configBot by using the `configBot` property in the options object that is passed to `os.createDebugger()`.
-   Updated the sidebar on the documentation site to be easier to use.
-   Updated the auth site branding.
-   Added well-formatted pages for the terms of service, privacy policy, and acceptable use policy to the auth website.

### :bug: Bug Fixes

-   Fixed an issue where floating labels on billboarded bots did not work.

## V2.0.12

#### Date: 10/8/2021

### :rocket: Improvements

-   Added the `os.createDebugger(options?)` function.
    -   `os.createDebugger()` can be used to create a separate sandbox area where bots can be tested without causing external effects.
    -   This is useful for automated testing scenarios where you want to validate how a script works (e.g. that a toast is shown) without actually performing the script results (i.e. actually showing the toast).
    -   Works by returning an object that contains a separate set of actions (like `create()` and `getBots()`) that can be used like normal.
        For example:
        ```typescript
        const debug = os.createDebugger();
        const debugBot = debug.create({ home: true, color: 'red' });
        ```
        Creates a bot that is contained in the debugger. Therefore, scripts on the `debugBot` will only affect bots that were created in the debugger.
    -   See the documentation for more information.
-   Added the `assert(condition, message?)` and `assertEqual(received, expected)` functions.
    -   These functions check that the given condition is true or that the values are equal to each other and throw an error if they are not.
    -   They can be useful for automated testing.
    -   See the documentation for examples.

### :bug: Bug Fixes

-   Fixed an issue where setting `meetPortalAnchorPoint` to `left` or `right` would not shift the `gridPortal` to the remaining space.

## V2.0.11

#### Date: 10/1/2021

### :boom: Breaking Changes

-   Renamed `server` to `inst`.
    -   This means that you should now `configBot.tags.inst` instead of `configBot.tags.server`.
    -   It also means that you now should go to `https://casualos.com?inst=my-aux` instead of `https://casualos.com?server=my-aux`.
    -   CasualOS will automatically replace `server` with `inst` on the first load so old links will continue to work.
-   Renamed `pagePortal` to `gridPortal`
    -   CasualOS will automatically replace `pagePortal` with `gridPortal` on first load (so old links will continue to work) but any scripts that change `pagePortal` will need to be updated to change `gridPortal`.
    -   `pagePortal` on the `configBot` should now be `gridPortal`.
    -   `pagePortalBot` is now `gridPortalBot`.
    -   Some functions now should reference the bot portal instead of the page portal:
        -   `os.getCameraPosition('page')` -> `os.getCameraPosition('grid')`
        -   `os.getCameraRotation('page')` -> `os.getCameraRotation('grid')`
        -   `os.getFocusPoint('page')` -> `os.getFocusPoint('grid')`
        -   `os.getPortalDimension('page')` -> `os.getPortalDimension('grid')`
    -   `@onPortalChanged` now uses `gridPortal` for `that.portal`.
-   Renamed `miniPortal` to `miniGridPortal`
    -   `miniPortal` on the `configBot` should now be `miniGridPortal`.
    -   `miniPortalBot` should now be `miniGridPortalBot`.
    -   Some functions now should reference the bot portal instead of the page portal:
        -   `os.getCameraPosition('mini')` -> `os.getCameraPosition('miniGrid')`
        -   `os.getCameraRotation('mini')` -> `os.getCameraRotation('miniGrid')`
        -   `os.getFocusPoint('mini')` -> `os.getFocusPoint('miniGrid')`
        -   `os.getPortalDimension('mini')` -> `os.getPortalDimension('miniGrid')`
    -   `@onPortalChanged` now uses `miniGridPortal` for `that.portal`.
-   Renamed some functions:
    -   `os.downloadServer()` -> `os.downloadInst()`
    -   `os.loadServer()` -> `os.loadInst()`
    -   `os.unloadServer()` -> `os.unloadInst()`
    -   `os.getCurrentServer()` -> `os.getCurrentInst()`
    -   `server.remotes()` -> `os.remotes()`
    -   `server.serverRemoteCount()` -> `os.remoteCount()`
    -   `server.servers()` -> `os.instances()`
    -   `server.serverStatuses()` -> `os.instStatuses()`
    -   `server.restoreHistoryMarkToServer()` -> `server.restoreHistoryMarkToInst()`.
    -   Note that some functions have moved to the `os` namespace from the `server` namespace. This is because most `server` functions do not work on CasualOS.com and are only designed to work with a server-based system (which CasualOS.com is not). To clarify this, functions that work all the time are now in the `os` namespace while the others are in the `server` namespace.
-   Renamed several listen tags:
    -   `@onServerJoined` -> `@onInstJoined`
    -   `@onServerLeave` -> `@onInstLeave`
    -   `@onServerStreaming` -> `@onInstStreaming`
    -   `@onServerStreamLost` -> `@onInstStreamLost`
    -   `@onServerAction` -> `@onAnyAction`

### :rocket: Improvements

-   Updated the Privacy Policy, Terms of Service, and Acceptable Use Policy.
-   Changed the meetPortal to use a custom Jitsi deployment.
-   Improved `os.enablePointOfView(center?)` to take an additional argument that determines whether to use the device IMU to control the camera rotation while in POV mode.
    -   The new function signature is `os.enablePointOfView(center?, imu?)`.
    -   e.g. `os.enablePointOfView(undefined, true)` will enable using the IMU for controlling the camera rotation.

### :bug: Bug Fixes

-   Fixed an issue where zooming on menu bots would trigger the browser-provided zoom functionality.
-   Fixed an issue where copying an array from one tag to another tag caused CasualOS to break.
-   Fixed an issue where editing a script via the sheet portal cells would temporarily break the code editor.

## V2.0.10

#### Date: 9/21/2021

### :rocket: Improvements

-   Improved the runtime to track changes to arrays without having to make a copy of the array or save it back to the tag.
-   Improved `os.getRecords(...filters)` to use `authBot.id` if `byAuthID()` is not specified.
-   Added `labelOpacity` tag.
-   Added `menuItemLabelStyle` tag.
-   Added the ability to use the `auto` value in the `scaleY` tag for menu bots. This automatically scales the menu bot height based on the amount of text in the label.
-   Added the ability to rotate around an object multiple times with `os.focusOn()` by setting `normalized` to `false` in the `rotation` property.
    -   By default, rotations passed to `os.focusOn()` are normalized to between 0 and `2π`.
    -   Setting `normalized` to `false` will skip this process and allow rotations larger than `2π` which in turn means the camera will rotate past `2π`.

## V2.0.9

#### Date: 9/7/2021

### :rocket: Improvements

-   Added the `os.requestPermanentAuthToken()` and `os.destroyRecord(record)` functions.
    -   `os.requestPermanentAuthToken()` is used to get auth tokens that can publish records to a app bundle from anywhere - including from other app bundles.
    -   `os.destroyRecord(record)` destroys the given record and makes it inaccessable via `os.getRecords()`. You must be logged in to destroy records and you can only destroy records that have been created by your user account and app bundle.
    -   See the documentation for more info.

### :bug: Bug Fixes

-   Fixed an issue where retrieving records from a temporary space can fail when the query matches no records.
-   Fixed an issue where CasualOS could permanently stall while loading.

## V2.0.8

#### Date: 9/7/2021

### :rocket: Improvements

-   Created https://casualos.me
    -   casualos.me is a companion service for CasualOS that provides the ability to sign in with an account and save permanent records of data.
-   Added the `os.requestAuthBot()` function.
    -   Requests that the user sign in and creates the `authBot` global variable to represent whether the user is signed in.
    -   Only works if an App Bundle (AB) was auto loaded using the `autoLoad` query parameter.
    -   Returns a promise that resolves when the user is signed in.
    -   See the "Auth Bot Tags" section in the documentation for more info.
-   Added the `os.publishRecord(recordDescription)` function to be able to save arbitrary JSON data.
    -   Records are arbitrary pieces of data that can saved and retrieved from special record-enabled spaces.
        -   The possible spaces are:
            -   `tempRestricted` - (Default) Records are temporary (they are deleted at the end of the day) and they are only retrievable by the user and appBundle that created them.
            -   `tempGlobal` - Records are temporary and they are they are retrievable by everyone.
            -   `permanentRestricted` - Records are permanent and they are only retrievable by the user and appBundle that created them.
            -   `permanentGlobal` - Records are permanent and they are retrievable by everyone.
    -   Unlike bots, records are only accessible by searching for them using the `os.getRecords()` function.
    -   Requires that the user has signed in with `os.requestAuthBot()`.
    -   `recordDescription` is an object with the following properties:
        -   `space` - The space that the record should be published to.
        -   `record` - The data that should be included in the record.
        -   `address` - (Optional) The address that the record should be published at. This can be omitted if a `prefix` is specified instead.
        -   `prefix` - (Optional) The prefix that the record should be published at. If used instead of `address`, CasualOS will calculate the `address` by concatenating the given prefix and ID like this: `"{prefix}{id}"`.
        -   `id` - (Optional) The ID that the record should be published at. If used with `prefix`, then CasualOS will combine the given `id` with the given `prefix` to calculate the `address`. If omitted, then CasualOS will generate a UUID to be used with the `prefix`.
        -   `authToken` - (Optional) The auth token that should be used to publish the record. This is useful for allowing other users to be able to publish records to an app bundle on your account. If omitted, then the `authToken` tag from the `authBot` will be used.
    -   Returns a promise that resolves when the record has been published.
    -   See the documentation for some examples.
-   Added the `os.getRecords(...filters)` function to be able to find and retrieve records.
    -   Works similarly to `getBots()` except that the list of possible filters is different and more limited.
    -   Possible filters are:
        -   `byAuthID(id)` - Searches for records that were published by the given auth ID. This filter is required for all `os.getRecords()` queries.
        -   `inSpace(space)` - Searches for records that were published to the given space. If omitted, only `tempRestricted` records will be searched.
        -   `byAddress(address)` - Searches for the record with the given address. Useful for finding a specific record.
        -   `byPrefix(prefix)` - Searches for records whose address starts with the given prefix. Useful for finding a list of records.
        -   `byID(id)` - Searches for records whose address equals `{prefix}{id}`. Works similarly to `byAddress()` except that you must also use `byPrefix()`. Useful for finding a specific record.
    -   Returns a promise that resolves with an object that contains a partial list of records.
        -   Using this object, you can see the total number of records that the query matched and get the next part of the list using the `getMoreRecords()` function.
        -   The object has the following structure:
            -   `records` - The list of records that were retrieved. This list may contain all the records that were found or it might only contain some of the records that were found. You can retrieve all of the records by looping and calling `getMoreRecords()` until it returns an object with `hasMoreRecords` set to `false`.
            -   `totalCount` - The total number of records that the query found.
            -   `hasMoreRecords` - Whether there are more records that can be retrieved for the query.
            -   `getMoreRecords()` - A function that can be called to get the next set of records for the query. Like `os.getRecords()`, this function returns a promise with an object that has the structure described above.
    -   See the documentation for some examples.
-   Added the `byID(id)` bot filter.
    -   This function can be used either as a bot filter with `getBots()` or as a record filter with `os.getRecords()`.
    -   As its name suggests, it can be used to find a bot with the given ID.

### :bug: Bug Fixes

-   Fixed an issue where using a `formAnimationAddress` prevented `formAnimation` from working correctly on first load.
-   Fixed an issue where `os.focusOn()` would not work on mobile devices.

## V2.0.7

#### Date: 8/16/2021

### :bug: Bug Fixes

-   Fixed an issue where remote whispers could cause CasualOS to think it was loaded before it actually was.
    -   This would in turn cause CasualOS to think that ab-1 was not installed and led to ab-1 getting duplicated which could then cause the auxCode to be loaded again.

## V2.0.6

#### Date: 8/11/2021

### :rocket: Improvements

-   Added the `formAnimationAddress` tag to allow specifying a separate GLTF/GLB URL that should be used for animations.
    -   This allows dynamically loading animations instead of requiring that all animations be built into the `formAddress` GLTF mesh.

### :bug: Bug Fixes

-   Fixed an issue where setting the `mapPortal` tag on the `configBot` to `null` would not close the map portal.
-   Fixed an issue where the camera would rotate somewhat randomly when facing straight down using touch controls.

## V2.0.5

#### Date: 7/27/2021

### :rocket: Bug Fixes

-   Fixed an issue where async scripts did not support JSX syntax highlighting.

## V2.0.4

#### Date: 7/27/2021

### :rocket: Improvements

-   Added the ability to download a PDF with embedded bot data by specifying a filename with a `.pdf` extension to `os.downloadBots()`.
-   Added the `os.parseBotsFromData(data)` function.
    -   This function can parse a list of bot mods from JSON or from the contents of a PDF that was created with `os.downloadBots()`.
    -   It returns a list of bot mods (i.e. mods that have the structure of bots) which can in turn be passed to `create()` to add them to the server.
-   Added the `os.unregisterApp(appID)` function to allow removing apps after they have been registered.
-   Added the ability to use [JSX](https://reactjs.org/docs/introducing-jsx.html) for Apps instead of the `html` string helper.
    -   JSX allows you to use a HTML-like language directly inside listeners. This provides some nice benefits including proper syntax highlighting and error messages.
    -   For example:
        ```javascript
        let result = <h1>Hello, World!</h1>;
        ```
    -   Due to convienience this will probably become the preferred way to write HTML for apps, however the `html` string helper will still be available.

## V2.0.3

#### Date: 7/19/2021

### :boom: Breaking Changes

-   "Custom Portals" are now called "Executables"
    -   This is because portals should deal almost exclusively with bots and heavily interface with CasualOS.
    -   "Custom Portals" (as they were called) made this difficult and are better explained as a way to create arbitrary web programs (i.e. executables).
    -   The new "Apps" (`os.registerApp()` and `os.compileApp()`) features make it easier to create custom portals since they can leverage bots and listen tags directly.
-   Renamed `portal.open()` to `os.registerExecutable()`.
-   Renamed `portal.buildBundle()` to `os.buildExecutable()`.
-   Renamed `portal.registerPrefix()` to `os.registerTagPrefix()`.
-   Changed the menuPortal to always be anchored to the bottom of the screen instead of to the miniPortal.

### :rocket: Improvements

-   Added the `os.registerApp(name, bot)` and `os.compileApp(name, content)` functions.
    -   `os.registerApp()` takes an app name and a bot and sets up a space for adding content to the CasualOS frontend.
    -   Calling `os.registerApp()` will also make the given bot available globally as `{name}Bot`.
    -   `os.registerApp()` returns a promise that resolves when the app has been setup and can accept content. Additionally, `onAppSetup` will be whispered to the bot that was specified for the app.
    -   `os.compileApp()` is used to provide content to an app. You can call this as many times as you want and the app will only update when you call `os.compileApp()` for it.
    -   See the docs for more information.
-   Added the `html` string helper.
    -   This can be used to produce HTML from a string for `os.compileApp()` by placing it before a string that uses backtick characters (`` ` ``).
    -   e.g.
        ```javascript
        let result = html`<h1>Hello, World!</h1>`;
        ```
    -   See the docs for more information.
-   Added the `watchBot(bot, callback)` and `watchPortal(portal, callback)` helper functions.
    -   `watchBot()` can be used to watch a given bot (or list of bots) for changes and triggers the given callback function when the bot(s) change.
    -   `watchPortal()` can be used to watch the given portal for changes and triggers the given callback function when the portal changes.
        -   Specifically, `watchPortal()` tracks when the portal is changed (by watching the portal tag on the `configBot`), when bots are added, removed, or updated in the portal, and when the portal bot changes.
-   Improved the bot dragging logic to support using `os.replaceDragBot(null)` to stop dragging a bot.

### :bug: Bug Fixes

-   Fixed an issue where dragging a bot whose position was animated in tempLocal space would produce no visible effect.
-   Fixed an issue where GLB models compressed with a newer version of Draco could not be loaded.
    -   You may have to refresh the browser tab 1 extra time after getting the update for this change to take effect. This is because the Draco library is cached by the web browser and updates to the library are checked in the background while the old version is being used.
-   Fixed an issue where bots in the mapPortal that had LOD listeners would not function correctly unless they had a label.

## V2.0.2

#### Date: 7/6/2021

### :rocket: Improvements

-   Improved the miniPortal to support the `portalCameraZoom`, `portalCameraRotationX` and `portalCameraRotationY` tags.
-   Added the `priorityShout()` function to make it easy to run a set of shouts until a bot returns a value.
-   Added the ability to control the foreground and background colors of the chat bar via the `foregroundColor` and `backgroundColor` options in `os.showChat()`.
-   Added the `date` type for `os.showInput()` to make entering days easier.

### :bug: Bug Fixes

-   Fixed an issue where camera position offsets would continuously be applied to the camera.
-   Fixed an issue where the menu would be positioned incorrectly if the meet portal was anchored to the top of the screen.
-   Fixed an issue where clicking on the grid with a controller in XR would crash CasualOS.
-   Fixed an issue where the transformer tag did not work correctly for bots in the mapPortal.
-   Fixed an issue where dragging an object that gets destroyed in an onPointerDown would freeze the UI.

## V2.0.1

#### Date: 6/9/2021

### :rocket: Improvements

-   Changed the default mapPortal basemap to `dark-gray`.
-   Changed the mapPortal to default to viewing Veterans Memorial Park in Grand Rapids.
    -   This makes it easier to start using AB-1 once the map portal is loaded.

### :bug: Bug Fixes

-   Fixed an issue where calling `os.focusOn()` with a position and no portal would default to the map portal.
-   Fixed an issue where calling `os.focusOn()` for the map portal before it was finished loading would error.

## V2.0.0

#### Date: 6/7/2021

### :bug: Improvements

-   Added the `mapPortal`.
    -   The map portal provides a 3D representation of the entire Earth and allows placing bots anywhere on it.
    -   Bots that are in the map portal use Longitude and Latitude for their X and Y coordinates.
    -   The map can additionally be customized by setting the `mapPortalBasemap` tag on the `mapPortalBot`. See the documentation for more information.
    -   Based upon [ArcGIS](https://www.arcgis.com/index.html).

### :bug: Bug Fixes

-   Fixed an issue where trying to focus on a position in the miniPortal would not work.

## V1.5.24

#### Date: 5/24/2021

### :rocket: Improvements

-   Improved the miniPortal to enable resizing it by dragging the top of the miniPortal instead of just at the corners.
-   Added the `math.normalizeVector()` and `math.vectorLength()` functions.

### :bug: Bug Fixes

-   Fixed an issue where events in some asynchronous scripts would be incorrectly reordered and potentially cause logic issues.

## V1.5.23

#### Date: 5/22/2021

### :boom: Breaking Changes

-   Renamed the `inventoryPortal` to `miniPortal`.
    -   The following were also renamed:
        -   `#inventoryPortalHeight` -> `#miniPortalHeight`
        -   `#inventoryPortalResizable` -> `#miniPortalResizable`
        -   `os.getInventoryPortalDimension()` -> `os.getMiniPortalDimension()`
        -   `os.hasBotInInventory()` -> `os.hasBotInMiniPortal()`
        -   `os.getPortalDimension("inventory")` -> `os.getPortalDimension("mini")`
        -   `os.getCameraPosition("inventory")` -> `os.getCameraPosition("mini")`
        -   `os.getCameraRotation("inventory")` -> `os.getCameraRotation("mini")`
        -   `os.getFocusPoint("inventory")` -> `os.getFocusPoint("mini")`
-   The `miniPortalHeight` tag was changed from being a number between 1 and 10 that represented the number of bots that should fit in the portal. Now it is a number between 0 and 1 that represents the percentage of the screen height it should take. Note that when `#miniPortalWidth` is less than 1 the height of the portal will be more like 80% of the screen height when set to 1. This is because of the mandatory spacing from the bottom of the screen to be somewhat consistent with the spacing on the sides.

### :rocket: Improvements

-   Added the `#miniPortalWidth` tag.
    -   Possible values are between 0 and 1.
    -   Represents the percentage of the screen width that the mini portal should take.
    -   When set to 1, the mini portal will appear docked and there will be no spacing between the bottom of the screen and the mini portal.

### :bug: Bug Fixes

-   Fixed a bunch of issues with zooming, rotating, and resizing the mini portal.

## V1.5.22

#### Date: 5/20/2021

### :rocket: Improvements

-   Added the `os.enableCustomDragging()` function to disable the default dragging behavior for the current drag operation.
    -   This is useful for custom dragging behavior that is associated with a bot like scaling the bot or rotating it.

### :bug: Bug Fixes

-   Fixed an issue where `os.focusOn()` would not work with bots in the inventory portal.

## V1.5.21

#### Date: 5/18/2021

### :rocket: Improvements

-   Improved `os.focusOn()` to support focusing on menu bots that have `#form` set to `input`.
-   Added the ability to snap dragged to a specific axis.

    -   These are special snap target objects that have the following form:

    ```typescript
    let snapAxis: {
        /**
         * The direction that the axis travels along.
         */
        direction: { x: number; y: number; z: number };

        /**
         * The center point that the axis travels through.
         */
        origin: { x: number; y: number; z: number };

        /**
         * The distance that the bot should be from any point along the
         * axis in order to snap to it.
         */
        distance: number;
    };
    ```

### :bug: Bug Fixes

-   Fixed an issue where the "tag has already been added" dialog displayed behind the sheet portal.

## V1.5.20

#### Date: 5/17/2021

### :bug: Bug Fixes

-   Fixed an issue where `@onInputTyping` was incorrectly shouted instead of whispered.

## V1.5.19

#### Date: 5/13/2021

### :rocket: Improvements

-   Added the `labelPaddingX` and `labelPaddingY` tags to allow controlling the padding along the width and height of labels separately.
-   Added the ability to use a URL for the `cursor` and `portalCursor` tags.
-   Added the `cursorHotspotX`, `cursorHotspotY`, `portalCursorHotspotX`, and `portalCursorHotspotY` tags to allow specifying the location that clicks should happen at in the custom cursor image. For example, a cursor that is a circle would have the hotspot in the middle but the default cursor has the hotspot at the top left.

## V1.5.18

#### Date: 5/11/2021

### :rocket: Improvements

-   Added the `AB1_BOOTSTRAP_URL` environment variable to control the URL that ab-1 gets loaded from.

## V1.5.17

#### Date: 5/10/2021

### :rocket: Improvements

-   Added the `cursor` and `portalCursor` tags.
    -   The `cursor` tag specifies the mouse cursor that should be shown when the bot is being hovered.
    -   The `portalCursor` tag specifies the mouse cursor that should be used by default for the page portal.
    -   See the documentation for a list of possible options.
-   Added the `labelPadding` tag to control how much space is between the edge of the bot and edge of the label.

## V1.5.16

#### Date: 5/7/2021

### :bug: Bug Fixes

-   Fixed an issue where it was no longer possible to cancel `setInterval()` with `clearTimeout()` and cancel `setTimeout()` with `clearInterval()`.
    -   They are not meant to be used together but because of an artifact of web browsers it needs to be supported.

## V1.5.15

#### Date: 5/7/2021

### :bug: Bug Fixes

-   Fixed an issue where it was impossible to clear intervals/timeouts from a bot other than the one it was created from.

## V1.5.14

#### Date: 5/7/2021

### :rocket: Improvements

-   Added the ability to clear bot timers using `clearInterval()` and `clearTimeout()`.
    -   `clearInterval(timerId)` is useful for clearing intervals created by `setInterval()`.
    -   `clearTimeout(timerId)` is useful for clearing timeouts created by `setTimeout()`

## V1.5.13

#### Date: 5/3/2021

### :bug: Bug Fixes

-   Fixed an issue where the meet portal could stay open if the portal was cleared before it was fully loaded.

## V1.5.12

#### Date: 5/2/2021

### :bug: Bug Fixes

-   Fixed an issue where `@onSubmit` was shouted to every bot instead of whispered to the bot that the input was submitted on.

## V1.5.11

#### Date: 4/27/2021

### :rocket: Improvements

-   Overhauled the `shared`, `tempShared`, and `remoteTempShared` spaces to use a faster and more efficient storage mechanism.
    -   There is now a new configuration environment variable `SHARED_PARTITIONS_VERSION` which controls whether the new spaces are used. Use `v1` to indicate that the old causal repo based system should be used and use `v2` to indicate that the new system should be used.
-   Added the `math.areClose(first, second)` function to determine if two numbers are within 2 decimal places of each other.
    -   For example, `math.areClose(1, 1.001)` will return true.
-   Improved the `atPosition()` and `inStack()` bot filters to use `math.areClose()` internally when comparing bot positions.
-   Improved handling of errors so they have correct line and column numbers in their stack traces.
    -   Currently, this only functions correctly on Chrome-based browsers (Chrome, Edge, Opera, etc.). Part of this is due to differences between how web browsers generate stack traces and part is due to what browsers support for dynamically generated functions.

### :bug: Bug Fixes

-   Fixed an issue with labels where an error could occur if the label text was updated while it was being rendered.
-   Fixed an issue where `clearAnimations()` would error if given a null bot.
-   Fixed an issue where autocomplete would not work correctly for properties on top level variables.

## V1.5.10

#### Date: 4/8/2021

### :boom: Breaking Changes

-   Renamed `onStreamData` to `onSerialData`.
-   Serial functions now require a "friendly" name to keep track of each device: `serialConnect`, `serialStream`, `serialOpen`, `serialUpdate`, `serialWrite`, `serialRead`, `serialClose`, `serialFlush`,`serialDrain`, `serialPause`, `serialResume`
-   `serialStream` now requires a bot id to send the stream to that bot.

### :rocket: Improvements

-   Improved the IDE Portal to support showing all tags by setting the `idePortal` tag on the config bot to `true`.
-   Added a search tab to the IDE Portal which makes it easy to search within tags that are loaded in the IDE Portal.
    -   It can be focused from the idePortal by using the `Ctrl+Shift+F` hotkey.
-   Added the `sheetPortalAddedTags` tag for the `sheetPortalBot` which specifies additional tags that should always be shown in the sheet portal.
-   Added support for auxcli v2.0.0 to retain current functionality.
-   Added support for multiple serial connections simultaneously.

### :bug: Bug Fixes

-   Fixed an issue where the `url` tag would not be created on initial load unless the URL was updated.

## V1.5.9

#### Date: 4/7/2021

### :rocket: Improvements

-   Added the ability to jump to a tag while in the IDE Portal using `Ctrl+P`.

### :bug: Bug Fixes

-   Fixed an issue where the `imuPortal` would return values that were incorrect for usage on the camera.
    -   Now, the `imuPortal` sets the `deviceRotationX`, `deviceRotationY`, `deviceRotationZ` and `deviceRotationW` values which is the rotation of the device represented as a quaternion.
    -   The `pagePortal` also now supports setting `cameraRotationOffsetW` to indicate that the offset should be applied as a quaternion.
    -   Try the `imuExample01` auxCode for an example.
-   Fixed an issue where CasualOS would fail to load on browsers that do not support speech synthesis.
-   Fixed an issue where bot updates that were executed via `action.perform()` would be treated like they were being performed by the user themselves.
    -   In particular, this issue affected text edits which were originally created by the multiline text editor but were then replayed via `action.perform()`.
    -   The effect of this bug would be that while the data was updated correctly, the multiline text editor would ignore the new data because it assumed it already had the changes.

## V1.5.8

#### Date: 4/5/2021

### :rocket: Improvements

-   Added the ability to see the full text of script errors by using the "Show Error" button in the multiline editor.

### :bug: Bug Fixes

-   Fixed an issue where the `imuPortal` would only open when set to a string value. Now it also supports `true` and non 0 numerical values.

## V1.5.7

#### Date: 4/2/2021

### :rocket: Improvements

-   Improved `imuPortal` to support Safari on iOS.
-   Added the `crypto.isEncrypted(cyphertext)`, `crypto.asymmetric.isEncrypted(cyphertext)`, and `crypto.asymmetric.isKeypair(keypair)` functions.
    -   These can help in determining if a string is supposed to be a asymmetric keypair or if it has been encrypted with symmetric or asymmetric encryption.

### :bug: Bug Fixes

-   Fixed an issue where the configBot would appear to be in the `shared` space but was actually in the `tempLocal` space.

## V1.5.6

#### Date: 4/1/2021

### :rocket: Improvements

-   Added the "bots" snap target for `os.addDropSnap()` and `os.addBotDropSnap()`.
    -   This will cause the dragged bot to snap to other bots.
-   Added the `experiment.speakText(text, options?)` and `experiment.getVoices()` functions.
    -   See the documentation for more information.
-   Added the `os.getGeolocation()` function.
    -   Returns a promise that resolves with the geolocation of the device.
-   Added the `imuPortal` to be able to stream IMU data into CasualOS.
    -   When defined on the config bot, the `imuPortalBot` will be updated with IMU data from the device.
    -   The following tags are used:
        -   `imuSupported` - Whether reading from the IMU is supported. This will be shortly after the `imuPortal` is defined.
        -   `deviceRotationX`, `deviceRotationY`, `deviceRotationZ` - The X, Y, and Z values that represent the orientation of the device.
-   Added the `portalCameraType` tag to allow switching between `perspective` and `orthographic` projections.
    -   Camera projections act similarly to real world camera lenses except that they avoid certain limitations like focal lengths.
    -   `orthographic` - This projection preserves parallel lines from the 3D scene in the output 2D image. As a result, same-sized objects appear the same size on the screen, regardless of how far away they are from the camera.
    -   `perspective` - This projection makes same-sized objects appear larger or smaller based on how far away they are from the camera. Closer objects appear larger and vice versa.
-   Added the `os.enablePointOfView(center?)` and `os.disablePointOfView()` functions.
    -   These are similar to `os.enableVR()` or `os.enableAR()` and can be used to give the player a "ground level" perspective in the page portal.
    -   `os.enablePointOfView(center?)` - Enables POV mode by moving the camera to the given position, setting the camera type to `perspective`, and changing the controls so that it is only possible to rotate the camera.
    -   `os.disablePointOfView()` - Disables POV mode by resetting the camera, camera type, and controls.

### :bug: Bug Fixes

-   Fixed an issue where tag edits would appear duplicated when running CasualOS in the non-collaborative mode.

## V1.5.5

#### Date: 3/25/2021

### :rocket: Improvements

-   Changed CasualOS to not show the `server` URL parameter when loaded in non-collaborative mode.
-   CasualOS will now throw an error when trying to save a bot to a tag during creation.

## V1.5.4

#### Date: 3/25/2021

### :rocket: Improvements

-   Improved `os.download()` to add the correct file extension if one is omitted from the given filename.
-   Added the 📖 emoji has a builtin tag prefix.
    -   This is a useful default prefix for custom portals.
-   Added the ability to load CasualOS in a non-collaborative mode.
    -   This will make the shared spaces (`shared`, `tempShared`, and `remoteTempShared`) act like they are `tempLocal` spaces.
    -   As a result, CasualOS needs no persistent network connection to run an experience when loaded in this mode.
-   Added the `os.isCollaborative()` function to get whether CasualOS was loaded in a collaborative mode or non-collaborative mode.

### :bug: Bug Fixes

-   Fixed the "Docs" link when linking to a listen tag.

## V1.5.3

#### Date: 3/23/2021

### :boom: Breaking Changes

-   Removed bot stacking.
    -   Bots will no longer automatically stack on each other based on position. Instead, they need to be stacked manually.
    -   The `{dimension}SortOrder` tags still exist and are used by the menu portal to order bots.
-   Drag events are now sent for bots that are not draggable.
    -   This means you can set `#draggable` to false and still get a `@onDrag` or `@onAnyBotDrag` event for it.
    -   This change makes it easier to write your own custom dragging logic because it prevents the bot(s) from being automatically moved but still sends the correct events.
    -   If you don't want drag events sent to a bot, you can make it not pointable or you can use your own custom logic on `@onDrag`/`@onDrop`.
-   The `#draggableMode` and `#positioningMode` tags have been removed.
    -   `#draggableMode` can be emulated by setting `#draggable` to false and adding custom `@onDrag` events to limit which dimensions the bot can be moved to.
    -   `#positioningMode` has been replaced with the `os.addDropSnap()` and `os.addBotDropSnap()` functions.

### :rocket: Improvements

-   Added the `@onAnyBotDropEnter` and `@onAnyBotDropExit` shouts.
-   Added the `@onAnyBotPointerDown` and `@onAnyBotPointerUp` shouts.
-   Added the `os.addDropSnap(...targets)` and `os.addBotDropSnap(bot, ...targets)` functions.
    -   These can be used to customize the behavior of a drag operation.
    -   Each function accepts one or more "targets" which are positions that the bot can be dropped at. There are 4 possible values:
        -   `"ground"` - The bot will snap to the ground as it is being dragged. (Default when not in VR)
        -   `"grid"` - The bot will snap to individual grid tiles as it is being dragged.
        -   `"face"` - The bot will snap to the face of other bots as it is being dragged.
        -   A snap point object. The bot will snap to the point when the mouse is within a specified distance. It should be an object with the following properties:
            -   `position` - An object with `x`, `y`, and `z` values representing the world position of the snap point.
            -   `distance` - The distance that the pointer ray should be from the position in order to trigger snapping to the position.
    -   The `os.addBotDropSnap(bot, ...targets)` function accepts a bot as its first parameter which limits the specified snap targets to when the given bot is being dropped on.
-   Added the `experiment.beginRecording(options?)` and `experiment.endRecording()` functions.
    -   These can be used to record both audio and video at the same time.
    -   See the documentation for more details.

### :bug: Bug Fixes

-   Fixed an issue where dragging a parent bot onto a child bot would cause the bot to rapidly snap back and forth.
-   Fixed an issue where negative sort orders could not be used on menu bots.

## V1.5.2

#### Date: 3/18/2021

### :bug: Bug Fixes

-   Fixed an issue where `os.focusOn()` would not function when using positions because inventory and page portals would fight over control of the animation operation.

## V1.5.1

#### Date: 3/17/2021

### :rocket: Improvements

-   Improved `os.focusOn()` to be canceled by `os.goToDimension()` and future calls to `os.focusOn()`.
    -   Additionally, calling `os.focusOn(null)` will cancel the current focus operation without queuing another one.

## V1.5.0

#### Date: 3/17/2021

### :boom: Breaking Changes

-   Changed the `#portalCameraRotationX` and `#portalCameraRotationY` tags to use radians instead of degrees.

### :rocket: Improvements

-   Added the `cameraZoom` and `cameraZoomOffset` tags.
-   Added the `os.focusOn(botOrPosition, options?)` function.
    -   Works similarly to `os.tweenTo()` and `os.moveTo()` except that it takes an options object instead of a bunch of parameters.
    -   Notable improvements includes that it can accept a position instead of a bot, it supports different easing types, and it will return a promise which completes when the camera movement is finished.
    -   Additionally the rotation values are in radians instead of degrees.
-   `os.focusOn()` and `os.tweenTo()` now use quadratic easing by default.
    -   Additionally `os.focusOn()` supports specifying the easing type just like `animateTag()`.
-   `os.tweenTo()` and `os.moveTo()` are now deprecated and should no longer be used. They will be removed in a future release of CasualOS.
    -   To encourage migration, they have been removed from the documentation and autocomplete.
-   Added the `experiment.beginAudioRecording()` and `experiment.endAudioRecording()` functions to experiment with audio recording.
    -   See the documentation for more information.

### :bug: Bug Fixes

-   Fixed an issue where camera offsets would not be taken into account when calculating the camera focus point.
    -   This fixes issues with the focus point becoming more and more wrong as offsets are applied to the camera.
    -   However, any calculations which try to calculate a camera position offset from the focus point must now subtract the current offset from the focus point to get the correct result. The example auxCode (`cameraMovementExample`) has been updated to reflect this change (version 2 and later).

## V1.4.11

#### Date: 3/12/2021

### :rocket: Improvements

-   Added the `math.scaleVector(vector, scale)` function to make multiplying vectors by scalar values easy.

### :bug: Bug Fixes

-   Fixed an issue where the `@onServerJoined` event could be sent before all data was loaded.
    -   This could happen if one player was changing data while another player was joining the server.
-   Fixed an issue where custom portals would not open if the portal tags were not defined when the portal is opened.
-   Fixed an issue where custom portals would always have default styling for their first load.

## V1.4.10

#### Date: 3/9/2021

### :rocket: Improvements

-   Improved `animateTag()` to support animating multiple tags at once by accepting an object for the `fromValue` and `toValue` options properties.
    -   Instead of calling `animateTag(bot, tag, options)`, omit the `tag` argument and call `animateTag(bot, options)`. This will indicate that you want to animate multiple tags at once over the same duration.
    -   The animations that get triggered are grouped together, so cancelling one will cancel them all.
-   Improved `clearAnimations()` to support accepting a list of tags to cancel.
-   Added several 3D math functions:
    -   `getBotPosition(bot, dimension)` - Gets the 3D position of a bot in the given dimension.
    -   `math.addVectors(...vectors)` - Adds the given vectors together and returns the result.
    -   `math.subtractVectors(...vectors)` - Subtracts the given vectors and returns the result.
    -   `math.negateVector(vector)` - Mathematically negates the given vector and returns the result.
-   Added the `os.getFocusPoint(portal?)` function to get the focus point that the camera is looking at.
    -   This value is the same as the one highlighted by the `#portalShowFocusPoint` tag.
    -   It is also backed up by `cameraFocusX`, `cameraFocusY`, `cameraFocusZ` tags on the portal bot.

## V1.4.9

#### Date: 3/3/2021

### :rocket: Improvements

-   Changed the color of the progress spinner and progress bar on the loading dialog to gray.

### :bug: Bug Fixes

-   Fixed an issue where hover events could be sent for bots when the mouse was not directly over the game view.
-   Fixed a couple issues where keyboard events were propagating outside the sheet and IDE portals.
-   Fixed an issue where local variables in the top scope would not be included in the code editor autocomplete box.

## V1.4.8

#### Date: 3/3/2021

### :boom: Breaking Changes

-   `onRemoteData` now uses `that.remoteId` instead of `that.playerId`.
-   Renamed the `portalPlayerZoom`, `portalPlayerRotationX` and `portalPlayerRotationY` tags to `portalCameraZoom` and `portalCameraRotationX` and `portalCameraRotationY`.
-   Renamed the `player` and `otherPlayers` spaces to `tempShared` and `remoteTempShared`.

### :rocket: Improvements

-   Added the `@onError` listen tag.
    -   It is a shout and is triggered when an unhandled error occurs in a listen tag.
-   Improved CasualOS to now include the Bot ID and tag name in internal console logs for unhandled errors.
-   Added perferred alternatives for the following functions and listen tags:
    -   `server.serverPlayerCount()` is now `server.serverRemoteCount()`.
    -   `server.totalPlayerCount()` is now `server.totalRemoteCount()`.
    -   `server.stories()` is now `server.servers()`.
    -   `server.players()` is now `server.remotes()`.
    -   `sleep()` is now `os.sleep()`
    -   `onServerSubscribed` is now `onServerJoined`.
    -   `onServerUnsubscribed` is now `onServerLeave`.
    -   `onPlayerPortalChanged` is now `onPortalChanged`.
    -   `onRemotePlayerSubscribed` is now `onRemoteJoined`
    -   `onRemotePlayerUnsubscribed` is now `onRemoteLeave`.
    -   Additionally, the `that.playerId` has been changed to `that.remoteId` in the new listen tags.
    -   Note that the original tags and functions remain the same but will be removed at some point in the future.
-   Added the `web.get()`, `web.post()`, and `web.hook()` functions as future replacements for the `webhook()` and `webhook.post()` functions.

### :bug: Bug Fixes

-   Fixed an issue where portal bots may not be defined before `@onServerSubscribed` is triggered.
-   Fixed an issue where the `white-space` CSS property could not be used on menu bots.

## V1.4.7

#### Date: 2/26/2021

### :boom: Breaking Changes

-   Renamed all the `player` functions to `os`.
    -   Instead of `player.toast()` you should now do `os.toast()`.
-   Removed the `configBot` and `configTag` variables.
-   Removed the portal config bot tags and replaced them with variables.
    -   e.g. `pagePortalConfigBot` can now be accessed with the `pagePortalBot` variable.
    -   You can now set the page portal color by doing `pagePortalBot.tags.portalColor = "green"`.
    -   By default a `tempLocal` bot will be created for each builtin portal.
    -   You can also provide your own bot by calling `portal.open(portalName, bot)`.
-   Changed the `portal.open()` function to take a bot as a parameter.
    -   It should now be called like `portal.open(name, bot, tag?, options?)`.
    -   After callilng this, the given bot will be available globally at `{name}Bot`.
    -   For example `portal.open("myPortal", bot, "main")` will make `bot` available as `myPortalBot`.
-   Removed `player.getBot()` and replaced it with `configBot`.
-   Renamed the `creator` variable to `creatorBot`.
-   Added the `thisBot` variable as a preferred alternative to `this` and `bot`.
-   Moved the page and inventory camera tags to their portal config bots from the player bot.
    -   e.g. `pageCameraPositionX` used to be on the player bot (now the config bot) but is now on the page portal bot.
-   Changed the behavior of the `transformer` tag to use the page and inventory portal bots instead of the config bot (previously the player bot).
-   Renamed the `pageCameraPosition{X,Y,Z}` and `inventoryCameraPosition{X,Y,Z}` tags to `cameraPosition{X,Y,Z}`.
-   Renamed the `pageCameraRotation{X,Y,Z}` and `inventoryCameraRotation{X,Y,Z}` tags to `cameraRotation{X,Y,Z}`.
-   Renamed the `pagePixelHeight` and `pagePixelWidth` tags to `pixelHeight` and `pixelWidth`.

### :bug: Bug Fixes

-   Fixed an issue where variables from other listen tags would appear as autocomplete options.

## V1.4.6

#### Date: 2/23/2021

### :bug: Bug Fixes

-   Fixed an issue where the circle wipe element would not cover modals like `player.showHtml()` or `player.showInput()`.
-   Fixed an issue where calling `player.showInput()` in sequence would show the first input but not the second input.

## V1.4.5

#### Date: 2/23/2021

### :rocket: Improvements

-   Changed the ab-1 bootstrap URL to `https://bootstrap.casualos.com/ab1.aux`.
-   Updated to three.js r125.
    -   This fixes WebXR for Chrome 88 and later.
-   Added the ability to disable hover states on menu item buttons using the `menuItemHoverMode` tag. It has three possible options:
    -   `auto` - The bot will appear hoverable based on if it has a `@onClick` tag. (Default)
    -   `hover` - The bot will appear hoverable.
    -   `none` - The bot will not appear hoverable.
    -   None of these options affect the existing functionality of any listen tags on menu bots.
-   Added an initial version of the `idePortal` (IDE portal).
    -   The IDE portal makes it easier to jump between tags to edit them in the multiline tag editor.
    -   Setting the `idePortal` tag to a prefix (like 📖) will load every tag that starts with the prefix into the IDE portal and let you jump between them as if they are files in a text editor.
    -   Currently it is pretty limited, but can be very useful for custom portals.

### :bug: Bug Fixes

-   Fixed an issue where it was not possible to enter numbers in menu bot input boxes.

## V1.4.4

#### Date: 2/18/2021

### :rocket: Improvements

-   Added additional crypto functions to support asymmetric encryption and decryption.
    -   `crypto.asymmetric.keypair(secret)` - Creates a keypair that can be used for asymmetric encryption and decryption.
    -   `crypto.asymmetric.encrypt(keypair, data)` - Encrypts some data using the given keypair.
    -   `crypto.asymmetric.decrypt(keypair, secret, data)` - Decrypts some data using the given keypair and secret.
    -   Check the documentation for more info.
-   Added a better error message when trying to save a bot to a tag value.
-   Added the `dimension` bot form as a preferred alias to `portal`.

## V1.4.3

#### Date: 2/17/2021

### :rocket: Improvements

-   Added the ability to interface with CasualOS from inside a custom portal.
    -   CasualOS-related functionality is available by importing functions and objects from the `casualos` module.
    -   Among the available functionality is `onBotsDiscovered`, `onBotsRemoved`, `onBotsUpdated`, `createBot()`, `destroyBot()`, and `updateBot()`.
    -   Additionally autocomplete is available for the available features.

### :bug: Bug Fixes

-   Fixed an issue where webhook errors could not be caught on Safari based browsers.

## V1.4.2

#### Date: 2/11/2021

### :rocket: Improvements

-   Added the ability to zoom by scrolling.
    -   Previously this was possible by holding the Ctrl button down.
-   Added the `#portalCameraControls` tag to allow disabling moving the camera.
    -   Can be set on the portal config bot for the page and inventory portals.
    -   Supported values are:
        -   `player` - Allows the player to move the camera around like normal. (Default)
        -   `false` - Disables camera movement in the portal.

### :bug: Bug Fixes

-   Fixed an issue where the inventory portal color could not be set when the page portal is using an image for the background.

## V1.4.1

#### Date: 2/10/2021

### :rocket: Improvements

-   Added the `player.openCircleWipe()` and `player.closeCircleWipe()` functions.
    -   These are useful for hiding the page portal while transitioning between scenes.
    -   See the documentation for usage information.
-   Added "cube", "helix", and "egg" as additional options for the `#formAddress` tag on menu bots.
-   Added the `input` form for menu bots.
    -   Setting `#form` to "input" on a bot that is in the menu portal will give it an input box that can be typed in.
    -   Typing in the box will send `@onInputTyping` whispers to the bot. And submitting the data by hitting enter or the send button will send a `@onSubmit` whisper to the bot.
    -   Additionally, the text in the input will be stored in the `tempLocal` `#menuItemText` tag.
-   Adjusted the chat bar to be inset in the page portal to give it the feel of being part of the page portal.
-   Added the `#menuPortalStyle` tag to allow customizing the menu portal with CSS.
    -   This works similarly to `#menuItemStyle` except that it applies to the entire menu portal instead of just one item.
    -   Set it on the `#menuPortalConfigBot`.
-   Added the `#portalBackgroundAddress` tag to allow specifying a custom image for the page portal background.
    -   Does not work in VR.

## V1.4.0

#### Date: 2/8/2021

### :rocket: Improvements

-   Added an initial implementation of custom portals.
    -   Custom portals are a way to write scripts that can interact directly with the web browser. This gives you the ability to do anything that is possible from inside a web browser.
    -   The following functions are now available:
        -   `portal.open(portalID, tag, options?)`
        -   `portal.registerPrefix(prefix)`
        -   `portal.buildBundle(tag)`
        -   See the documentation for usage information.
-   Added the `player.download(data, filename, mimeType?)` function.
    -   Useful for downloading arbitrary data in any format you want.
    -   See the documentation for more information.

### :bug: Bug Fixes

-   Fixed an issue that broke bots in the `player` space when a `tempLocal` tag mask was put on them.
-   Fixed an issue that prevented tag masks from being placed on new bots.

## V1.3.14

#### Date: 1/25/2021

### :rocket: Improvements

-   Updated the Terms of Service and Privacy Policy documents.

### :bug: Bug Fixes

-   Fixed an issue where animations would not run while in VR/AR.

## V1.3.13

#### Date: 1/18/2021

### :rocket: Improvements

-   Added the `player.showUploadFiles()` function.
    -   Shows a dialog that can be used to upload arbitrary files.
    -   Returns a promise that resolves with the list of files that were uploaded.
    -   See the documentation for more info.
-   Added the `portal` form.
    -   Displays an entire dimension in place of the bot form.
    -   When set, `#formAddress` will be used as the dimension that should be loaded.

### :bug: Bug Fixes

-   Fixed an issue where bot labels would flicker when scaling the bot.
-   Fixed an issue where tag masks would be incorrectly recorded by the UI as being removed in some cases.
-   Fixed an issue where lines would render incorrectly on the first frame they were setup on.

## V1.3.12

#### Date: 1/13/2021

### :rocket: Improvements

-   Added the Terms of Service and Privacy Policy documents.
    -   The Terms of Service are available at `/terms` (or at `/terms-of-service.txt`).
    -   The Privacy Policy is available at `/privacy-policy` (or at `/privacy-policy.txt`).
-   Added the ability to keep track of the number of `setTimeout()` and `setInterval()` timers that are currently active via the `numberOfActiveTimers` property returned from `perf.getStats()`.
-   Added the `animateTag(bot, tag, options)` and `clearAnimations(bot, tag?)` functions.
    -   `animateTag(bot, tag, options)` - Iteratively changes a tag mask value over time based on the options you provide.
        -   `bot` is the bot or list of bots that should be animated.
        -   `tag` is the tag that should be animated.
        -   `options` is an object that specifies how the tag should be animated. It has the following properties:
            -   `fromValue` - The starting value for the animation.
            -   `toValue` - The ending value.
            -   `duration` - The number of seconds that it should take for the tag to go from the starting value to the ending value.
            -   `easing` - The options for easing the animation.
            -   `tagMaskSpace` - The space that the tag should be changed in. If set to `false` then the tag on the bot will be directly edited.
    -   `clearAnimations(bot, tag?)` - Cancels animations on a bot.
        -   `bot` - The bot or list of bots that should have their animations canceled.
        -   `tag` - Is optional and is the tag that the animations should be canceled for.

### :bug: Bug Fixes

-   Fixed issues with `#labelFontSize = auto` when `#labelPosition != front` or when the bot is rotated.
-   Fixed an issue where non-ASCII characters were being corrupted on download.

## V1.3.11

#### Date: 1/5/2021

### :rocket: Improvements

-   Greatly improved the default layouting behaviour of labels.
    -   Added the `#labelFontSize` tag to control the sizing of the characters in a label. Unlike `#labelSize`, changing this value will cause the label to layout again which will affect word wrapping. Possible values are:
        -   `auto` - Specifies that the system should try to find a font size that fits the text onto the bot. (default)
        -   Any Number - Specifies a specific font size. (1 is previous default)
    -   Added the `#labelWordWrapMode` tag to control the word wrapping behavior of labels. Possible values are:
        -   `breakCharacters` - Specifies that the system should insert line breaks inside words if needed.
        -   `breakWords` - Specifies that the system should insert line breaks between words if needed.
        -   `none` - Specifies that the system should not insert line breaks.
-   Added the ability to control the color of the placeholder text in the chat bar.
    -   Use the `placeholderColor` option when calling `player.showChat()`.

### :bug: Bug Fixes

-   Fixed an issue where atoms that were received before their cause would be discarded.

## V1.3.10

#### Date: 12/29/2020

### :rocket: Improvements

-   Added a button to the Multiline tag editor to make it easy to turn a tag into a Mod tag.

### :bug: Bug Fixes

-   Fixed an issue where script compilation errors would not be handled correctly and would prevent those changes from being communicated to the multiline code editor.

## V1.3.9

#### Date: 12/28/2020

### :boom: Breaking Changes

-   Formulas have been removed and replaced with Mod tags.
    -   Mod tags are tags that start with the DNA Emoji (🧬) and contain JSON data.
    -   Because Mod tags are JSON data, they do not support programmatic computations.
    -   We are making this change because while formulas are powerful, inprecise use of them can result in large slowdowns which is a bad user experience.
    -   The tag data must be valid JSON, so that means using double-quotes `"` for strings and wrapping property names in double-quotes.
        -   Before:
            ```
            =({ color: 'blue', number: 99, toggle: true })
            ```
            After:
            ```
            🧬{ "color": "blue", "number": 99, "toggle": true }
            ```
        -   Before:
            ```
            =([ 1 + 2 ])
            ```
            After:
            ```
            🧬3
            ```
-   Array-like values in tags are now considered strings.
    -   Previously a value like `[1, 2, 3]` was parsed into an array automatically.
    -   This was a little used feature and caused issues for people who simply wanted to store JSON data in a tag.
    -   Now, a value like `[1, 2, 3]` will no longer be parsed and so will appear as the string: `"[1, 2, 3]"`.
    -   If you want CasualOS to parse a tag value as an array, you can use the Mod tags mentioned above.
-   Removed the `error` space.
    -   Also removed the related functions:
        -   `server.destroyErrors()`
        -   `server.loadErrors()`

### :rocket: Improvements

-   Updated Material Icons to v4.0.0.
-   Added `perf.getStats()` as a way to get some statistics on the performance of the server.
-   Various performance improvements:
    -   `getBot('id', id)` is now works in `O(1)` time.
    -   The `tempLocal` and `local` spaces now handle new and deleted bots in a much more performant manner.
-   Fixed an issue where deleted bots in the `shared` space would be treated like they were not deleted on initial load.

### :bug: Bug Fixes

-   Fixed autofocusing newly created tags in the sheetPortal.

## V1.3.8

#### Date: 12/17/2020

### :bug: Bug Fixes

-   Fixed an issue where selecting a color from a `player.showInput()` modal would not save the selected color.

## V1.3.7

#### Date: 12/17/2020

### :boom: Breaking Changes

-   "story" has been renamed to "server". Below is the list of tags, actions and listeners that have been changed:
    -   `#story` -> `#server`.
    -   `server.setupStory()` -> `server.setupServer()`
    -   `server.restoreHistoryMarkToStory()` -> `server.restoreHistoryMarkToServer()`
    -   `server.storyStatuses()` -> `server.serverStatuses()`
    -   `server.storyPlayerCount()` -> `server.serverPlayerCount()`
    -   `player.downloadStory()` -> `player.downloadServer()`
    -   `player.loadStory()` -> `player.loadServer()`
    -   `player.unloadStory()` -> `player.unloadServer()`
    -   `player.getCurrentStory()` -> `player.getCurrentServer()`
    -   `@onStoryAction` -> `@onServerAction`
    -   `@onStoryStreaming` -> `@onServerStreaming`
    -   `@onStoryStreamLost` -> `@onServerStreamLost`
    -   `@onStorySubscribed` -> `@onServerSubscribed`
    -   `@onStoryUnsubscribed` -> `@onServerUnsubscribed`

## V1.3.6

#### Date: 12/17/2020

### :rocket: Improvements

-   Added the ability to show a password input by using the `secret` type with `player.showInput()`.

### :bug: Bug Fixes

-   Fixed an issue where some bots would not be added to the page portal when created in a big batch.
-   Fixed an issue where the `player.showInput()` dialog would appear fullscreen on mobile devices and prevent people from exiting it.
-   Fixed an issue where `@onChatTyping` would be triggered twice for each keystroke.

## V1.3.5

#### Date: 12/15/2020

### :rocket: Improvements

-   Changed `create()` to prevent creating bots that have no tags.
    -   If a bot would be created with zero tags then an error will be thrown.
-   Added a favicon.

### :bug: Bug Fixes

-   Changed the maximum WebSocket message size to 32KB from 128KB.
    -   This will help ensure that we keep below the [AWS API Gateway maximum frame size of 32 KB](https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html).
-   Fixed an issue where bots that only had a tag mask would not show up in the sheetPortal.

## V1.3.4

#### Date: 12/10/2020

### :rocket: Improvements

-   Added the `EXECUTE_LOADED_STORIES` environment variable to allow reducing server load due to story scripts.
    -   Defaults to `true`.
    -   Setting to `false` will disable all server-side story features except for webhooks and data portals.
        -   This means that some capabilities like `server.setupStory()` will not work when `EXECUTE_LOADED_STORIES` is false.
-   Added gzip compression for HTML, CSS, and JavaScript returned from the server.
-   Improved how some heavy assets are precached so that they can be loaded quickly.
-   Made the browser tab title use the story ID by default.

### :bug: Bug Fixes

-   Fixed an issue where some `.png` files would not load because they were bundled incorrectly.

## V1.3.3

#### Date: 12/10/2020

### :rocket: Improvements

-   Added support for the `apiary-aws` causal repo protocol.
    -   This enables the CasualOS frontend to communicate with instances of the [CasualOS Apiary AWS](https://github.com/casual-simulation/casual-apiary-aws) project.
    -   Use the `CAUSAL_REPO_CONNECTION_PROTOCOL` and `CAUSAL_REPO_CONNECTION_URL` environment variables to control which protocol and URL the frontend should connect to. See the [README in `aux-server`](./src/aux-server/README.md) for more info.
    -   Note that only the following features are supported for AWS Apiaries:
        -   `server.setupStory()`
        -   `server.totalPlayerCount()`
        -   `server.storyPlayerCount()`
        -   `server.players()`
    -   Webhooks are different when the story is hosted on an Apiary.
        -   They require at least one device to have the story loaded for webhooks to function correctly.
        -   They need to be sent to the Apiary host directly. Generally, this is not the same thing as `auxplayer.com` or `casualos.com` so you may need to ask the Apiary manager for it.
-   Added better support for static builds.
    -   Use the `PROXY_CORS_REQUESTS` environment variable during builds to disable support for proxying HTTP requests through the server.
    -   Use `npm run tar:client` after a build to produce a `./temp/output-client.tar.gz` containing all the client code and assets. This can be deployed to S3 or a CDN for static hosting.
    -   Use `npm run package:config` to produce a `./temp/config.json` which can be used for the `/api/config` request that the client makes at startup. Utilizes the environment variables from [the README in `aux-server`](./src/aux-server/README.md) to build the config.

### :bug: Bug Fixes

-   Fixed an issue where it was not possible to change the color of GLTF meshes that did not have a mesh in the GLTF scene root.
-   Fixed an issue where bots created by the ab1 installer would not receive the `@onStorySubscribed` shout.

## V1.3.2

#### Date: 11/17/2020

### :rocket: Improvements

-   Updated the ab-1 bootstrapper to point to AWS S3 for quick loading.

## V1.3.1

#### Date: 11/16/2020

### :rocket: Improvements

-   Added the ability to use the `color` tag on GLTF meshes to apply a color tint to the mesh.

### :bug: Bug Fixes

-   Fixed an issue that prevented deleting the first character of a script/formula in the multi-line editor.
-   Fixed an issue where tag edits on bots in the tempLocal and local spaces would be applied to the multi-line editor twice.

## V1.3.0

#### Date: 11/11/2020

### :rocket: Improvements

-   Added multi-user text editing.
    -   Work on shared bots when editing a tag value with the multi-line editor.
-   Added the cursor bot form.
    -   Used to add a cursor indicator to the multi-line editor.
    -   Works by setting the `form` tag to "cursor" and placing the bot in the corresponding tag portal dimension.
        -   For example, to put a cursor in the multi-line editor for the `test` tag on a bot you would set `{targetBot.id}.test` to true.
    -   Supported tags are:
        -   `color` - Specifies the color of the cursor.
        -   `label` - Specifies a label that should appear on the cursor when the mouse is hovering over it.
        -   `labelColor` - Specifies the color of the text in the cursor label.
        -   `{dimension}Start` - Specifies the index at which the cursor selection starts (Mirrors `cursorStartIndex` from the player bot).
        -   `{dimension}End` - Specifies the index at which the cursor selection ends (Mirrors `cursorEndIndex` from the player bot).
-   Added the `pageTitle`, `cursorStartIndex`, and `cursorEndIndex` tags to the player bot.
    -   `pageTitle` is used to set the title of the current browser tab.
    -   `cursorStartIndex` contains the starting index of the player's text selection inside the multi-line editor.
    -   `cursorEndIndex` contains the ending index of the player's text selection inside the multi-line editor.
    -   Note that when `cursorStartIndex` is larger than `cursorEndIndex` it means that the player has selected text from the right to the left. This is important because text will always be inserted at `cursorEndIndex`.
-   Added the `insertTagText()`, `deleteTagText()`, `insertTagMaskText()`, and `deleteTagMaskText()` functions to allow scripts to work with multi-user text editing.
    -   `insertTagText(bot, tag, index, text)` inserts the given text at the index into the given tag on the given bot.
    -   `insertTagMaskText(bot, tag, index, text, space?)` inserts the given text at the index into the tag and bot. Optionally accepts the space of the tag mask.
    -   `deleteTagText(bot, tag, index, deleteCount)` deletes the given number of characters at the index from the tag and bot.
    -   `deleteTagMaskText(bot, tag, index, deleteCount, space?)` deletes the given number of characters at the index from the tag and bot. Optionally accepts the space of the tag mask.
-   Added the ability to use the `transformer` tag on the player bot to parent the player to a bot.
-   Added the ability to edit tag masks in the tag portal by setting the `tagPortalSpace` tag on the player bot.

## V1.2.21

#### Date: 11/5/2020

### :rocket: Improvements

-   Updated the MongoDB driver to v3.6.2 and added the `MONGO_USE_UNIFIED_TOPOLOGY` environment variable to control whether the driver uses the new unified topology layer.

## V1.2.20

#### Date: 10/27/2020

### :rocket: Improvements

-   Added support for `@onPointerEnter`, `@onPointerExit`, `@onAnyBotPointerEnter` and `@onAnyBotPointerExit` for bots in the menu portal.

### :bug: Bug Fixes

-   Fixed the multiline code editor to not clip tooltips and the autocomplete box.
-   Fixed the menu portal to not break on Hololens (Servo-based browsers) when a progress bar is placed on a menu item.

## V1.2.19

#### Date: 10/22/2020

### :rocket: Improvements

-   Added the `egg` form for bots.
    -   Displays the bot as an egg like how ab-1 appears as an egg before being activated.
-   Added the `hex` form for bots.
    -   Displays the bot as a hexagon.
-   Added the `pagePixelWidth` and `pagePixelHeight` tags to the player bot.
    -   These indicate the size of the image rendered to the page portal in pixels.

### :bug: Bug Fixes

-   Fixed Draco compression support.

## V1.2.18

#### Date: 10/20/2020

### :bug: Bug Fixes

-   Fixed the code editor.

## V1.2.17

#### Date: 10/20/2020

### :rocket: Improvements

-   Improved bots in the menu portal to support additional tags.
    -   Added the ability to change the height of menu items by using `scale` and `scaleY`.
    -   Added the ability to set an icon for a menu item by using the `formAddress` tag.
    -   Added the ability to set arbitrary CSS styles on a menu bot by using the `menuItemStyle` tag.
        -   This lets you use margins and borders to indicate grouping.
    -   Added the ability to show a pie-chart progress bar on a menu item by using the `progressBar` tags.
    -   Added the ability to use `@onPointerUp` and `@onPointerDown` for menu.

## V1.2.16

#### Date: 10/16/2020

### :rocket: Improvements

-   Added the `transformer` tag.
    -   When set to a bot ID, the bot will inherit the position, rotation, and scale of the specified bot inside the page portal.
    -   This produces a "parenting" effect that is common in most 3D graphics engines.

## V1.2.15

#### Date: 10/12/2020

### :rocket: Improvements

-   Added the `experiment.getAnchorPointPosition()` and `math.getAnchorPointOffset()` functions.
    -   These are useful for determining where a bot would be placed if it had a particular anchor point.
    -   See the [docs](https://docs.casualsimulation.com/docs/actions) for more info.

## V1.2.14

#### Date: 10/7/2020

### :bug: Bug Fixes

-   Fixed an issue where calling `server.setupStory()` twice with the same story name would cause the story to be setup twice.
-   Fixed an issue where bots would be incorrectly removed from the menu portal if they existed in both the old and new dimensions.
-   Greatly reduced the number of scenarios where formulas would be recalculated after any change.

## V1.2.13

#### Date: 9/24/2020

### :boom: Breaking Changes

-   Renamed the `_editingBot` tag to `editingBot`.

### :rocket: Improvements

-   sheetPortal Improvements
    -   Added the `@onSheetTagClick` listener which is triggered when a tag name is clicked.
    -   Added the `@onSheetBotIDClick` listener which is triggered when a Bot ID is clicked.
    -   Added the `@onSheetBotClick` listener which is triggered when a bot visualization is clicked in the sheet.
    -   Added the `sheetPortalShowButton` config bot tag to control whether the button in the bottom right corner of the sheet is shown.
    -   Added the `sheetPortalButtonIcon` config bot tag to control the icon on the button in the bottom right corner of the sheet.
    -   Added the `sheetPortalButtonHint` config bot tag to control the tooltip on the button in the bottom right corner of the sheet.
    -   Added the `sheetPortalAllowedTags` config bot tag to control which tags are allowed to be shown and edited in the sheet portal.
    -   Swapped the position of the new bot and new tag buttons in the sheet.
    -   Added the `editingTag` tag which contains the tag that the player is currently editing.

### :bug: Bug Fixes

-   Fixed an issue where cells in the sheet portal would not cover the entire cell area.
-   Fixed an issue where `clearTagMasks()` would error if given a bot that had no tag masks.

## V1.2.12

#### Date: 9/22/2020

### :rocket: Improvements

-   Added the `helix` form.
    -   Displays a DNA strand mesh whose color can be customized.
-   Added tag masks.
    -   Tag masks are special tags that can live in a separate space from their bot.
    -   This makes it possible to create a temporary tag on a shared bot.
    -   Tag masks do not replace tags. Instead, they exist in addition to normal tags and can be used to temporarily hide a normal tag value.
    -   Like bots, tag masks live in a space. This means that a bot can have multiple masks for a particular tag. Currently the supported spaces are:
        -   `tempLocal`
        -   `local`
        -   `player`/`otherPlayers`
        -   `shared`
    -   New scripting features:
        -   All bots now have a `masks` property which works like `tags` except that it creates tag masks in the `tempLocal` space.
        -   All scripts also have a `masks` property which is a shortcut for `bot.masks`.
        -   `setTagMask(bot, tag, value, space?)` is a new function that is able to set the value of a tag mask on the given bot and in the given space. See the documentation for more info.
        -   `clearTagMasks(bot, space?)` is a new function that is able to clear all the tag masks in the given space from a given bot. See the documentation for more info.
    -   Example use cases:
        -   Local click/hover states.
        -   Animations.
        -   Storing decrypted data.

### :100: Other Changes

-   Pinned the Deno version to `v1.4` so that we can decide when to adopt future Deno updates.

### :bug: Bug Fixes

-   Fixed an issue where `server.setupStory()` would load a simulation and never dispose it.
-   Fixed an issue where wrist portals were not being anchored properly.
-   Fixed an issue where pressing enter to make a new tag would put a new line in the current tag value.

## V1.2.11

#### Date: 9/9/2020

### :bug: Bug Fixes

-   Fixed an issue where zooming was broken when the page portal is not anchored to the top left of the screen.

## V1.2.10

#### Date: 9/8/2020

### :bug: Bug Fixes

-   Fixed an issue with the multiline editor getting cut off inside the tag portal.

## V1.2.9

#### Date: 9/8/2020

### :rocket: Improvements

-   Changed the page portal to resize around the tag portal instead of being hidden behind it.

## V1.2.8

#### Date: 9/8/2020

### :boom: Breaking Changes

-   Changed `experiment.localPositionTween()` and `experiment.localRotationTween()` to take different arguments and return a promise.
    -   the 4th parameter is now an options object instead of the easing options.
    -   This options object is able to accept easing and duration values.
    -   Additionally the functions now return promises.
    -   See the docs for examples.

### :bug: Bug Fixes

-   Fixed an issue where `experiment.localPositionTween()` and `experiment.localRotationTween()` may not execute if triggered during `@onCreate()`.

## V1.2.7

#### Date: 9/4/2020

### :boom: Breaking Changes

-   Changed `@onListen` to only be sent to bots which have a listener for the shout/whisper.
    -   Previously `@onListen` would be sent to all bots that were targeted by the shout/whisper.
-   Changed `shout()` and `whisper()` to cost 1 energy point.
    -   This helps prevent infinite loops.
    -   The energy point is only deducted if a bot has a listener for the event.

### :bug: Bug Fixes

-   Fixed an issue where `onBotAdded`, `onAnyBotsAdded`, `onAnyBotsRemoved`, `onBotChanged`, and `onAnyBotsChanged` would reset the energy counter.

## V1.2.6

#### Date: 9/4/2020

### :bug: Bug Fixes

-   Fixed an issue where whispering to a bot that is null or undefined would end up sending a shout to all bots.

## V1.2.5

#### Date: 8/31/2020

### :rocket: Improvements

-   Added the `pageCameraPositionOffset[X,Y,Z]`, `inventoryCameraPositionOffset[X,Y,Z]`, `pageCameraRotationOffset[X,Y,Z]`, and `inventoryCameraRotationOffset[X,Y,Z]` tags.
    -   These can be used to move the camera apart from the player's input.
    -   The position offset tags are especially useful for warping the player around in VR.
-   Added the ability to use the dynamic `import()` keyword to import arbitrary JavaScript modules.
    -   Useful with https://www.skypack.dev/ to import modules from [NPM](https://www.npmjs.com/).
-   Added the ability to use `player.replaceDragBot()` even when not dragging.
-   Improved the camera zoom functionality to zoom the camera towards and away from the mouse.
-   Added the `experiment.localPositionTween()` and `experiment.localRotationTween()` functions.
    -   Locally animates a bot's position/rotation using the given easing type.
    -   During the animation, changes to the bot position will be ignored.
    -   Once the animation is done, changes to the bot will reset the position/rotation to the value that is currently stored.
    -   Check out the docs for detailed usage information and examples.

### :bug: Bug Fixes

-   Fixed the dataPortal to always return raw tag values unless they are formulas.
    -   Issue with returning incorrect JSON data was caused by the built-in CasualOS array parsing.
    -   This fixes it by skipping any parsing of the data.
-   Fixed an issue where keyboard states would not be reset when the player removed focus from the story.
-   Fixed an issue where `server.setupStory()` would crash the deno process due to incorrectly handling deserialized data.

## V1.2.4

#### Date: 8/26/2020

### :rocket: Improvements

-   Added the `tagPortalShowButton` tag to control whether a button should be shown in the tag portal.
    -   The button is placed at the lower right hand side of the tag portal.
    -   Clicking the button will trigger a `@onClick` on the tag portal config bot.
    -   Two additional tags can be used to customize the button:
        -   `tagPortalButtonIcon` is the icon that is shown on the button and can be set to any [Material Icon](https://material.io/resources/icons/?style=baseline).
        -   `tagPortalButtonHint` is the text that should be shown in the tooltip for the button.
-   Added the `frustum` form.
-   Improved `player.showInput()` to automatically save and close when a color is selected from the color picker.
    -   Applies to the `basic` and `swatch` subtypes but not `advanced`.
-   Improved the multiline editor to have a "Docs" button that links to the documentation for the current tag.
-   Improved the tag portal to support using `@` and `#` symbols at the beginning of the tag.
    -   Implemented for consistency with functions like `getBot()`, `getTag()`, etc.
-   Added the `@onAnyBotPointerEnter` and `@onAnyBotPointerExit` listen tags.
    -   These are shouts that happen whenever a `@onPointerEnter` or `@onPointerExit` whisper occurs.
-   Added the `player.getPointerDirection()`, `math.getForwardDirection()` and `math.intersectPlane()` functions.
    -   These are useful for calculating where a pointer is pointing.
-   Added the ability to store uncommitted atoms in MongoDB.
    -   Can be configred with the `STAGE_TYPE` environment variable. Can be set to either `redis` or `mongodb`. Currently defaults to `redis` until a migration path is implemented.
-   Added a bunch of extra GPIO-related functions.
    -   `server.rpioReadpad()`
    -   `server.rpioWritepad()`
    -   `server.rpioPud()`
    -   `server.rpioPoll()`
    -   `server.rpioI2CBegin()`
    -   `server.rpioI2CSetSlaveAddress()`
    -   `server.rpioI2CSetBaudRate()`
    -   `server.rpioI2CSetClockDivider()`
    -   `server.rpioI2CRead()`
    -   `server.rpioI2CWrite()`
    -   `server.rpioI2CEnd()`
    -   `server.rpioPWMSetClockDivider()`
    -   `server.rpioPWMSetRange()`
    -   `server.rpioPWMSetData()`
    -   `server.rpioSPIBegin()`
    -   `server.rpioSPIChipSelect()`
    -   `server.rpioSPISetCSPolarity()`
    -   `server.rpioSPISetClockDivider()`
    -   `server.rpioSPISetDataMode()`
    -   `server.rpioSPITransfer()`
    -   `server.rpioSPIWrite()`,
    -   `server.rpioSPIEnd()`

### :bug: Bug Fixes

-   Fixed to safely allow editing multiline scripts in the sheet cells.
-   Fixed an issue with the tag portal where it would not respond to changes with the `tagPortal` tag if it was already set.
-   Fixed an issue with the Deno sandbox where it wouldn't load due to missing dependencies.
-   Fixed an issue where 3D content would not occlude iframe forms.
    -   Only fixed for non-Safari web browsers.

## V1.2.3

#### Date: 8/20/2020

### :rocket: Improvements

-   Added the tag portal.
    -   The tag portal is similar to the sheet portal but it shows only the multiline editor for the specified bot ID and tag.
    -   Set the `tagPortal` tag on the player bot to a string with a Bot ID and a tag name separated by a period (`.`).
-   Improved `player.playSound(url)` to return a promise that resolves with a sound ID.
    -   This sound ID can be used with `player.cancelSound(soundID)` to stop the sound from playing.
-   Added the `player.bufferSound(url)` and `player.cancelSound(soundID)` functions.
    -   `player.bufferSound(url)` can be used to pre-load a sound so that there will be no delay when using `player.playSound()`.
        -   Returns a promise that resolves once the sound has been loaded.
    -   `player.cancelSound(soundID)` can be used to stop a sound that is already playing.
        -   Returns a promise that resolves once the sound has been canceled.

### :bug: Bug Fixes

-   Fixed an issue where actions that were created in an async script would not be dispatched until the script finished.

## V1.2.2

#### Date: 8/14/2020

### :boom: Breaking Changes

-   Changed `crypto.encrypt()` and `crypto.decrypt()` to return the result directly instead of returning a promise.

### :rocket: Improvements

-   Added the `crypto.createCertificate()`, `crypto.signTag()`, and `crypto.verifyTag()`, `crypto.revokeCertificate()` functions to help with creating certificate chains and signing and validating tag data. Check the docs for detailed usage information.
-   Added an indicator to the multi-line editor that is shown when a tag value is verified.
-   Added the ability to force all scripts to be verified in order to be executed using the `forceSignedScripts` query parameter.
    -   When the query param is set to `true`, all scripts must have a valid signature in order to be executed.
    -   This allows running in a trusted execution environment - thereby preventing unauthorized scripts from running.
-   Replaced builder with ab-1.
    -   ab-1 is a new version of builder which is designed to be easy to extend and improve.
-   Added the `adminSpace.setPassword(oldPassword, newPassword)` function.
    -   Allows changing the password that is used to unlock admin space.
    -   The first parameter is the old password that was used to unlock the space.
    -   The second parameter is the new password that should be used to unlock the space.
-   Added several functions to allow using the GPIO pins on Rasberry Pi.
    -   Currently, all of these functions are experimental and only work on Raspberry Pi.
    -   See the documentation for more information.
    -   `server.exportGpio(pin, mode)`
    -   `server.unexportGpio(pin, mode)`
    -   `server.setGpio(pin, value)`
    -   `server.getGpio(pin)`
    -   `server.rpioInit(options)`
    -   `server.rpioExit()`
    -   `server.rpioOpen(pin, mode, options)`
    -   `server.rpioMode(pin, mode, options)`
    -   `server.rpioRead(pin)`
    -   `server.rpioReadSequence(pin, length)`
    -   `server.rpioWrite(pin, value)`
    -   `server.rpioWriteSequence(pin, buffer)`
    -   `server.rpioClose(pin, options)`

### :bug: Bug Fixes

-   Fixed an issue where using `player.showInput()` with an existing value would not prefill the text box with the existing value.
-   Fixed a performance issue where formulas which were recalculated after every change had a factorial (!) performance cost.
    -   Was caused by two things:
        1.  Some formulas don't have enough information to determine what tags they are dependent on. In these cases, we callback to using an "all" dependency which means that the formula will be recalculated whenever any tag changes.
        2.  These "all" dependencies were included when searching for nested dependencies which meant that we were resolving every "all" dependency for every other "all" dependency. This gives us the effect of searching every possible combination of dependencies instead of only the ones we need, which has a factorial cost.

## V1.2.1

#### Date: 8/4/2020

### :rocket: Improvements

-   Added a server sandbox based on [Deno](https://deno.land/).
    -   Security feature to prevent scripts that are running on the server from harming the underlying system or other stories.
    -   It additionally prevents scripts from accessing random Node.js modules by using `require("module")`.
    -   Finally, it prevents a script from denying service to other stories because the sandbox is run inside a separate process.
-   Improved the sheet portal to display scripts with a monospace font in the sheet cells.
-   Improved the documentation to clarify some things and also mension that bots can be made transparent with the "clear" color.
-   Improved the multi-line text editor to support syntax highlighting for HTML, CSS, and JSON based on whether the tag ends with `.html`, `.css` or `.json`.

### :bug: Bug Fixes

-   Fixed the `lineTo` tag to support arrays of bots and arrays of bot IDs in addition to individual bots and bot IDs.
-   Fixed an issue where deleting a tempLocal bot that was updated in the same script would crash the runtime.
-   Fixed an issue with the `player.showInput()` modal where Android devices using the Google GBoard keyboard wouldn't send input correctly.
-   Fixed an issue where a `@onPlayerPortalChanged` event would be incorrectly triggered after reconnecting to the server.
-   Fixed an issue where the iframe form on iOS 14 Beta 3 would cause the entire scene to disappear.
-   Fixed an issue where loading an image could fail if `formAddress` tag was changed while the image was downloading.
-   Fixed an issue where submitting HTML forms from inside an iframe form was not allowed.

## V1.2.0

### Date: 7/17/2020

### Changes:

-   :rocket: Improvements

    -   Added the `MONGO_USE_NEW_URL_PARSER` environment variable parameter to control whether CasualOS uses the new MongoDB URL Parser. (Defaults to false)
    -   Added a popup to notify the user that data might be lost if they attempt to close the tab while not connected to the server.
    -   Added the following cryptographic functions:
        -   `crypto.sha256(data)`
            -   Calculates the [SHA-256](https://en.wikipedia.org/wiki/SHA-2) hash of the given data.
            -   `data` is the data to calculate the hash of.
            -   Supports strings, numbers, booleans, objects, arrays, and bots.
        -   `crypto.sha512(data)`
            -   Calculates the [SHA-512](https://en.wikipedia.org/wiki/SHA-2) hash of the given data.
            -   `data` is the data to calculate the hash of.
            -   Supports strings, numbers, booleans, objects, arrays, and bots.
        -   `crypto.hmacSha256(key, data)`
            -   Calculates the [HMAC](https://en.wikipedia.org/wiki/HMAC) [SHA-256](https://en.wikipedia.org/wiki/SHA-2) hash of the given data.
            -   `key` is the password that should be used for the message authentication code.
            -   `data` is the data to calculate the HMAC of.
            -   Supports strings, numbers, booleans, objects, arrays, and bots.
        -   `crypto.encrypt(password, data)`
            -   Encrypts the given data with the given password and returns the result as a promise.
            -   `password` is the password to use for encrypting the data.
            -   `data` is the data that should be encrypted.
        -   `crypto.decrypt(password, data)`
            -   Decrypts the given data with the given password and returns the result as a promise.
            -   Only works if the given data is the output of `crypto.encrypt()`.
            -   `password` is the password that was used to encrypt the data.
            -   `data` is the data that should be decrypted.

-   :bug: Bug Fixes
    -   Fixed a race condition where concurrently updating a tag in a script and triggering a dependency update on that same tag could cause the runtime to crash.

## V1.1.18

### Date: 7/10/2020

### Changes:

-   :rocket: Improvements

    -   Improved the `player.run()` function to return a promise that can be awaited to get the result of the script (or wait until the script has been executed).
    -   Improved the `server.loadErrors()` function to return a promise that can be awaited to get the list of bots that were loaded.
    -   Improved the `server.destroyErrors()` function to return a promise that resolves once the error bots are destroyed.
    -   Improved the `server.loadFile()` function to return a promise that resolves once the file is loaded.
    -   Improved the `server.saveFile()` function to return a promise that resolves once the file is saved.
    -   Improved the `server.setupStory()` function to return a promise that resolves once the story is setup.
    -   Improved the `server.browseHistory()` function to return a promise that resolves once the history is loaded.
    -   Improved the `server.markHistory()` function to return a promise that resolves once the history is saved.
    -   Improved the `server.restoreHistoryMark()` function to return a promise that resolves once the history is restored.
    -   Improved the `server.restoreHistoryMarkToStory()` function to return a promise that resolves once the history is restored.
    -   Added the `@onBotAdded` and `@onAnyBotsAdded` listen tags.
        -   These are triggered whenever a bot is added to the local story.
        -   Note that this is different from `@onCreate` because you will be notified whenever a bot is added to the state even if it has already been created.
        -   An example of this are bots in the `otherPlayers` space. You cannot create bots in this space but you will be notified via `@onBotAdded` and `@onAnyBotsAdded`.
        -   `@onBotAdded` is triggered on the bot that was added. There is no `that`.
        -   `@onAnyBotsAdded` is triggered on every bot whenever one or more bots are added.
            -   `that` is an object with the following properties:
                -   `bots` - The array of bots that were added.
    -   Added the `@onAnyBotsRemoved` listen tags.
        -   These are triggered whenever a a bot is removed from the local story.
        -   Note that this is different from `@onDestroy` because you will be notified whenever a bot is removed from the state even if it has not been explicitly destroyed.
        -   An example of this are bots in the `otherPlayers` space. When another player disconnects no `@onDestroy` is fired but you will get a `@onAnyBotsRemoved`.
        -   `@onAnyBotsRemoved` is triggered on every bot whenever one or more bots are removed.
            -   `that` is an object with the following properties:
                -   `botIDs` - The array of bot IDs that were removed.
    -   Added the `@onBotChanged` and `@onAnyBotsChanged` listen tags.
        -   These are triggered whenever a bot is changed in the local story.
        -   Note that you will be notified whenever a bot is changed in the state even if it was changed by another player.
        -   An example of this are bots in the `otherPlayers` space. You cannot update bots in this space but you will be notified via `@onBotChanged` and `@onAnyBotsChanged`.
        -   `@onBotChanged` is triggered on the bot that was changed.
            -   `that` is an object with the following properties:
                -   `tags` - The list of tags that were changed on the bot.
        -   `@onAnyBotsAdded` is triggered on every bot whenever one or more bots are added.
            -   `that` is an array containing objects with the following properties:
                -   `bot` - The bot that was updated.
                -   `tags` - The tags that were changed on the bot.
    -   Added several tags to the player bot:
        -   These tags are updated by CasualOS and can be used to query the current state of the input system.
        -   Camera Tags
            -   These tags contain the position and rotation of the player's camera.
            -   You can use this to communicate where the player is to other players.
            -   `pageCameraPositionX`
            -   `pageCameraPositionY`
            -   `pageCameraPositionZ`
            -   `inventoryCameraPositionX`
            -   `inventoryCameraPositionY`
            -   `inventoryCameraPositionZ`
            -   `pageCameraRotationX`
            -   `pageCameraRotationY`
            -   `pageCameraRotationZ`
            -   `inventoryCameraRotationX`
            -   `inventoryCameraRotationY`
            -   `inventoryCameraRotationZ`
        -   Pointer Tags
            -   These tags contain the position and rotation of the player's pointers.
            -   You can use this to tell where the VR controllers are or where the mouse is pointing.
            -   `mousePointerPositionX`
            -   `mousePointerPositionY`
            -   `mousePointerPositionZ`
            -   `mousePointerRotationX`
            -   `mousePointerRotationY`
            -   `mousePointerRotationZ`
            -   `mousePointerPortal`
            -   `rightPointerPositionX`
            -   `rightPointerPositionY`
            -   `rightPointerPositionZ`
            -   `rightPointerRotationX`
            -   `rightPointerRotationY`
            -   `rightPointerRotationZ`
            -   `rightPointerPortal`
            -   `leftPointerPositionX`
            -   `leftPointerPositionY`
            -   `leftPointerPositionZ`
            -   `leftPointerRotationX`
            -   `leftPointerRotationY`
            -   `leftPointerRotationZ`
            -   `leftPointerPortal`
        -   Button Tags
            -   These tags contain the state of the different buttons.
            -   Possible values are:
                -   `null` - Button is not pressed.
                -   `down` - Button was just pressed.
                -   `held` - Button is being held down.
            -   `mousePointer_left`
            -   `mousePointer_right`
            -   `mousePointer_middle`
            -   `leftPointer_primary`
            -   `leftPointer_squeeze`
            -   `rightPointer_primary`
            -   `rightPointer_squeeze`
            -   `keyboard_[key]`
                -   Replace `[key]` with the key that you want the state of.
                -   For example use `keyboard_a` to get the state of the `a` key.
    -   Added the `player.getCameraPosition(portal?)` function.
        -   `portal` is optional and is the portal (`page` or `inventory`) that the camera position should be retrieved for.
        -   Returns an object with the following properties:
            -   `x`
            -   `y`
            -   `z`
    -   Added the `player.getCameraRotation(portal?)` function.
        -   `portal` is optional and is the portal (`page` or `inventory`) that the camera rotation should be retrieved for.
        -   Returns an object with the following properties:
            -   `x`
            -   `y`
            -   `z`
    -   Added the `player.getPointerPosition(pointer?)` function.
        -   `pointer` is optional and is the pointer (`mouse`, `left` or `right`) that the position should be retrieved for.
        -   Returns an object with the following properties:
            -   `x`
            -   `y`
            -   `z`
    -   Added the `player.getPointerRotation(pointer?)` function.
        -   `pointer` is optional and is the pointer (`mouse`, `left` or `right`) that the rotation should be retrieved for.
        -   Returns an object with the following properties:
            -   `x`
            -   `y`
            -   `z`
    -   Added the `player.getInputState(controller, button)` function.
        -   `controller` is the controller (`mousePointer`, `leftPointer`, `rightPointer`, `keyboard` or `touch`) that the button state should be retrieved from.
        -   `button` is the name of the button that should be retrieved.
        -   Returns a string containing the state of the button or `null` if the button is not pressed.
            -   `"down"` means that the button just started to be pressed.
            -   `"held"` means that the button is being held down.
            -   `null` means that the button is not pressed.
    -   Added the `player.getInputList()` function.
        -   Returns a list of available inputs that can be used by the `player.getInputState()` function.

-   :bug: Bug Fixes
    -   Fixed an issue where toasting recursive objects could break CasualOS.
        -   Fixed by storing a map of previously converted objects to avoid reconverting them infinitely.
        -   Also improved to gracefully handle objects that are nested too deeply.
    -   Fixed an issue with the show input modal where it incorrectly errored sometimes.

## V1.1.17

### Date: 7/3/2020

### Changes:

-   :bug: Bug Fixes
    -   Fixed an issue where the web browser service worker would incorrectly intercept requests for data portals.

## V1.1.16

### Date: 7/2/2020

### Changes:

-   :rocket: Improvements
    -   Added the ability to respond to webhooks by returning data from `@onWebhook`.
        -   If the returned value is a string, then it will be used for the response.
        -   If the returned value is an object, then it should have the following properties:
            -   `data` - The value that should be used as the body of the response.
            -   `headers` - An object that contains the HTTP headers that should be set on the response. (Optional)
            -   `status` - The numerical status code that should be set on the response. (Optional) If omitted, status code 200 will be used.
    -   Added the `dataPortal`.
        -   This is a special portal that only works on web requests and must be specified in the URL.
        -   Setting it to a Bot ID will return the JSON of the bot with the given ID.
        -   Setting it to a tag will return all the values corresponding to the given tag.
        -   Using a tag with a common extension (like `.html`) will tag the data as the corresponding content type so that normal software know how to interpret the data.

## V1.1.15

### Date: 7/2/2020

### Changes:

-   :rocket: Improvements

    -   Added player space to the server.
        -   This lets you send remote whispers to the `server` player.
    -   Added the `server.storyStatuses()` function.
        -   Returns a promise that resolves with a list of stories and the last time each story was updated.
    -   Added the `@onRemotePlayerSubscribed` and `@onRemotePlayerUnsubscribed` listen tags.
        -   They are triggered on _every_ other player when a player joins or leaves the story.
        -   Additionally, they are triggered whenever connection to the other players is lost.
        -   `that` is an object with the following properties:
            -   `playerId` - The ID of the player that joined/left the story.
    -   Added the `uuid()` function.
        -   This function generates and returns a random [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier).
        -   Useful for creating unique identifiers.

-   Bug Fixes
    -   Fixed an issue where remote shouts would be sent to yourself twice.
    -   Fixed an issue where labels would not always follow the `labelAlignment` tag when the text in the label was small enough to fit within the bot.

## V1.1.14

### Date: 6/29/2020

### Changes:

-   :rocket: Improvements

    -   Improved how the meet portal, page portal, and sheet portal work together to make space for each other.
    -   Added the `left` and `right` options for `meetPortalAnchorPoint`.
    -   Changed the `top` and `bottom` options for `meetPortalAnchorPoint` to occupy half of the screen.
    -   Added the `server.players()` function to get the list of player IDs that are connected to the current story.
        -   Returns a promise that resolves with the list of player IDs.
    -   Added the `remoteWhisper(players, name, arg)` function to make sending messages to other players easy.
        -   Takes the following arguments:
            -   `players` is the player ID or list of player IDs that should receive the shout.
            -   `name` is the name of the message.
            -   `arg` is the data that should be included.
        -   This will trigger a `@onRemoteWhisper` shout on all the specified players.
    -   Added the `remoteShout(name, arg)` function to make sending messages to all players easy.
        -   Takes the following arguments:
            -   `name` is the name of the message.
            -   `arg` is the data that should be included.
    -   Added the `@onRemoteWhisper` listen tag that is shouted when a `remoteWhisper()` or `remoteShout()` is sent to the local player.
        -   `that` is an object with the following properties:
            -   `name` - The name of the shout that was sent.
            -   `that` - The data which was sent.
            -   `playerId` - The ID of the player that sent the shout.

-   Bug Fixes
    -   Fixed an issue that prevented using `lineStyle` in place of `auxLineStyle`.

## V1.1.13

### Date: 6/25/2020

### Changes:

-   :rocket: Improvements

    -   Added the `meetPortal`.
        -   This is a special portal that, instead of loading bots, loads a [Jitsi Meet](https://meet.jit.si/) meeting with the given room code.
        -   All rooms are publicly accessible (but not searchable), so longer room codes will be more private.
        -   You can use the `meetPortalConfigBot` option to reference the bot that should be used to configure the meet portal.
        -   The following options are available:
            -   `meetPortalVisible` - Whether the meet portal should be visible. This allows you to be joined to a meet while keeping your screen on the page portal. (Defaults to true)
            -   `meetPortalAnchorPoint` - The anchor point that the meet portal should use. Possible options are:
                -   `fullscreen` - The meet portal should take the entire screen. (Default)
                -   `top` - The meet portal should take the top of the screen.
                -   `topRight` - The meet portal should take the top-right corner of the screen.
                -   `topLeft` - The meet portal should take the top-left corner of the screen.
                -   `bottom` - The meet portal should take the bottom of the screen.
                -   `bottomRight` - The meet portal should take the bottom-right corner of the screen.
                -   `bottomLeft` - The meet portal should take the bottom-left corner of the screen.
                -   `[top, right, bottom, left]` - The meet portal should use the given values for the CSS top, right, bottom, and left properties respectively.
            -   `meetPortalStyle` - The CSS style that should be applied to the meet portal container.
                -   Should be a JavaScript object.
                -   Each property on the object will map directly to a CSS property.
                -   Useful for moving the meet portal to arbitrary positions.

-   :bug: Bug Fixes

    -   Fixed an issue where the Hololens 2 would not be able to enter AR/VR because a controller's (hand) position would sometimes be null.
    -   Fixed an issue where loading without a story would create a new random story but then immediately unload it.
    -   Fixed an issue where local bots from other stories would be loaded if the current story name happened to be a prefix of the other story name.
    -   Fixed the input modal background.
    -   Fixed the TypeScript definitions for the `player.showInput()` function.

## V1.1.12

### Date: 6/18/2020

### Changes:

-   :bug: Bug Fixes

    -   Fixed an issue where Servo-based browsers would run into a race condition during initialization.

## V1.1.11

### Date: 6/18/2020

### Changes:

-   :rocket: Improvements
    -   Added a reflog and sitelog for stories so that it is possible to track the history of a story branch and which sites have connected to it.
        -   This will make it easier for us to recover from data loss issues in the future since we'll be able to lookup data like the last commit that a branch pointed at or which atoms were added to a branch.
-   :bug: Bug Fixes

    -   Fixed an issue where all bots would appear to be in the `shared` space even though they were not.
    -   Fixed issues with loading on Servo-based browsers.
        -   The issues were mostly related to Servo having not implemented IndexedDB yet.
    -   Fixed an issue where some temporary branches would show up in `server.stories()`.

## V1.1.10

### Date: 6/16/2020

### Changes:

-   :bug: Bug Fixes

    -   Fixed an issue where an incorrectly formatted event would crash the server.
    -   Fixed an issue where the server would incorrectly store atoms added to a temporary branch.

## V1.1.9

### Date: 6/16/2020

### Changes:

-   :rocket: Improvements
    -   Added the `player` and `otherPlayers` spaces.
        -   These spaces are special and interact with each other.
        -   Both the `player` space and `otherPlayers` space are shared but the lifetime of the bots is temporary. In this sense, the bots act like temporary shared bots.
        -   However, bots created in the `player` space will show up in the `otherPlayers` space to other players and vice versa.
        -   This means you can share temporary bots with other players by using the `player` space and see the temporary bots shared by other players by inspecting the `otherPlayers` space.
        -   Important Notes:
            -   The `player` space only contains bots that you create while `otherPlayers` contains bots that other players have created.
            -   You can create, edit, and destroy bots in the `player` space, but not in the `otherPlayers` space.
            -   When you close your session (exit the browser or close the tab), all of your `player` bots will be automatically destroyed. This will also automatically remove them from any `otherPlayers` spaces that they may be in.
-   :bug: Bug Fixes

    -   Fixed an issue where using a single minus sign in a tag would be interpreted as a number.
    -   Fixed an issue where some tags would not be included in the JSON output of a bot.

## V1.1.8

### Date: 6/12/2020

### Changes:

-   :rocket: Improvements

    -   Changed what words the story name auto-generation will use.

## V1.1.7

### Date: 6/11/2020

### Changes:

-   :rocket: Improvements

    -   Added the ability to auto-generate a story name when loading CasualOS without a story.

-   :bug: Bug Fixes
    -   Fixed an issue where objects that have an `id` property that is not a string would break the sheet.

## V1.1.6

### Date: 6/11/2020

### Changes:

-   :boom: Breaking Changes

    -   Renamed all the history tags to not have the `aux` prefix.

-   :rocket: Improvements

    -   Added the `server.storyPlayerCount()` function.
        -   Returns a promise that resolves with the number of players currently connected to the current story.
        -   Optionally accepts a parameter which indicates the story to check.
    -   Added the `server.totalPlayerCount()` function.
        -   Returns a promise that resolves with the total number of players connected to the server.
    -   Added the `server.stories()` function.
        -   Returns a promise that resolves with the list of stories that are on the server.

-   :bug: Bug Fixes
    -   Removed the globals bot tags from the documentation since they no longer exist.

## V1.1.5

### Date: 6/9/2020

### Changes:

-   :boom: Breaking Changes

    -   The following tags have been renamed:
        -   Renamed all the tags so that they no longer have the `aux` prefix. However, any tag not listed below should continue to work with the `aux` prefix without any changes.
        -   Renamed `auxUniverse` to `story`.
        -   Renamed `auxCreator` to `creator`.
            -   Note that the `creator` variable in scripts remains the same.
        -   Renamed `auxConfigBot` to `configBot`.
            -   Note that the `config` variable in scripts remains the same.
        -   Renamed `auxGLTFVersion` to `gltfVersion`.
        -   Renamed `auxPagePortal` to `pagePortal`.
        -   Renamed `auxSheetPortal` to `sheetPortal`.
        -   Renamed `auxInventoryPortal` to `inventoryPortal`.
        -   Renamed `auxMenuPortal` to `menuPortal`.
        -   Renamed `auxLeftWristPortal` to `leftWristPortal`.
        -   Renamed `auxRightWristPortal` to `rightWristPortal`.
        -   Renamed `auxPagePortalConfigBot` to `pagePortalConfigBot`.
        -   Renamed `auxSheetPortalConfigBot` to `sheetPortalConfigBot`.
        -   Renamed `auxInventoryPortalConfigBot` to `inventoryPortalConfigBot`.
        -   Renamed `auxMenuPortalConfigBot` to `menuPortalConfigBot`.
        -   Renamed `auxLeftWristPortalConfigBot` to `leftWristPortalConfigBot`.
        -   Renamed `auxRightWristPortalConfigBot` to `rightWristPortalConfigBot`.
        -   Renamed `_auxEditingBot` to `_editingBot`.
    -   Renamed "universe" to "story". The following tags and functions have been affected:
        -   `auxUniverse` -> `story`
        -   `onUniverseAction` -> `onStoryAction`
        -   `onUniverseStreaming` -> `onStoryStreaming`
            -   The `universe` property has been renamed to `story`
        -   `onUniverseStreamLost` -> `onStoryStreamLost`
            -   The `universe` property has been renamed to `story`
        -   `onUniverseSubscribed` -> `onStorySubscribed`
            -   The `universe` property has been renamed to `story`
        -   `onUniverseUnsubscribed` -> `onStoryUnsubscribed`
            -   The `universe` property has been renamed to `story`
        -   `player.downloadUniverse()` -> `player.downloadStory()`
        -   `player.loadUniverse()` -> `player.loadStory()`
            -   The action type has been renamed from `load_universe` to `load_story`.
        -   `player.unloadUniverse()` -> `player.unloadStory()`
            -   The action type has been renamed from `unload_universe` to `unload_story`.
        -   `player.getCurrentUniverse()` -> `player.getCurrentStory()`
        -   `player.checkout()`
            -   The `processingUniverse` property has been renamed to `processingStory`.
        -   `player.showJoinCode()`
            -   The `universe` property on the `show_join_code` action has been renamed to `story`
        -   `server.restoreHistoryMark()`
            -   The `universe` property on the `restore_history_mark` action has been renamed to `story`.
        -   `server.restoryHistoryMarkToUniverse()` -> `server.restoreHistoryMarkToStory()`
        -   `server.setupUniverse()` -> `server.setupStory()`
            -   The action type has been renamed from `setup_universe` to `setup_story`.

-   :rocket: Improvements

    -   Improved MongoDB to store all atoms for a commit inside the same document. This should improve loading performance since MongoDB will only need to make 1 lookup per universe instead of 1 lookup per atom per universe.
    -   Added admin space.
        -   Admin space is a space that is shared between all universes on the same auxPlayer.
        -   It is locked by default, which means that bots that are in it cannot be created, updated, or destroyed.
        -   You can unlock admin space by using the `adminSpace.unlock(password)` function.
            -   It returns a Promise that resolves once the space is unlocked. If the space was unable to be unlocked, then the promise will reject with an error.
            -   `password` is the password that should be used to unlock the admin space. If incorrect, admin space will remain locked.
    -   Removed the CasualOS tagline from the loading popup.
    -   Improved the `webhook()` and `webhook.post()` functions to return promises.
        -   The promise can be awaited and resolves with the an an object with the following properties:
            -   `data` - The data returned from the webhook. If the returned data was JSON, then this will be an object. Otherwise, it will be a string.
            -   `status` - The numerical HTTP status code that was returned.
            -   `statusText` - The name of the HTTP status code that was returned.
            -   `headers` - The HTTP headers that were included in the response.
    -   Improved the `neighboring()` function to allow omitting the `direction` parameter.
        -   When omitted, all supported directions will be included.
        -   Currently, the supported directions are `front`, `right`, `back`, and `left`.
        -   If an unsupported direction is given, then no bots will be included.
    -   Updated the Documentation website to the [latest version of Docusaurus](https://github.com/facebook/docusaurus/releases/tag/v2.0.0-alpha.56).
    -   Added the `renameTag(bot, originalTag, newTag)` function which makes it easy to rename a tag on a bot or list of bots.
        -   `bot` is the bot or list of bots that should have the tag renamed.
        -   `originalTag` is the name of the tag that should be renamed.
        -   `newTag` is the new name that the tag should have.

-   :bug: Bug Fixes
    -   Fixed an issue where destroying an already destroyed bot would incorrectly destroy an unrelated bot.
    -   Fixed an issue where using `player.run()` to execute an invalid script would cause other actions to fail.
    -   Added some extra spacing to labels to help prevent Z-fighting.
    -   Fixed toasting bots by converting them to copiable values. This will also allow toasting unconventional arguments like function and error objects.
    -   Fixed an issue where the menu would stop repositioning after the inventory portal had been hidden.
    -   Fixed an issue where tapping on the screen while in AR would crash the session.
    -   Fixed an issue where labels would be positioned incorrectly if `#anchorPoint` was set to something other than `bottom`.

## V1.1.4

### Date: 5/18/2020

### Changes:

-   :bug: Bug Fixes
    -   Fixed an issue where Builder could not be created/updated due to being unable to load .aux files with a version field.

## V1.1.3

### Date: 5/18/2020

### Changes:

-   :bug: Bug Fixes
    -   Fixed inconsistent menu item names in Builder.

## V1.1.2

### Date: 5/18/2020

### Changes:

-   :rocket: Improvements

    -   Added the `#auxLabelFontAddress` tag to allow specifying a custom font for a label.
        -   Supports any URL and also the following values:
            -   `roboto` - Specifies that the Roboto font should be used. (default)
            -   `noto-sans-kr` - Specifies that the Noto Sans KR font should be used. This is a Korean-specific font.
        -   Supports [WOFF](https://en.wikipedia.org/wiki/Web_Open_Font_Format) and [OTF](https://en.wikipedia.org/wiki/OpenType) files.
    -   Sheet Changes
        -   Removed the tag filters.
        -   Moved the "Close Sheet" button to be a floating button that is at the lower right corner of the sheet.
        -   Changed the "Close Sheet" button icon and changed the tooltip text to "Page Portal".
        -   Made the `#id` tag not clickable.
    -   Builder Changes
        -   Renamed the "Sheet" and "Sheet New Tab" menu items to "Sheet Portal" and "Sheet Portal New Tab".
        -   Made the chat bar not automatically show when opening a menu.

-   :bug: Bug Fixes
    -   Fixed an issue where updating a bot would not update its raw tags.

## V1.1.1

### Date: 5/7/2020

### Changes:

-   :rocket: Improvements

    -   Added the `#auxPortalDisableCanvasTransparency` tag to allow choosing between transparency for iframes and more correct 3D rendering.

        -   Set this to `true` on the page portal config bot to disable transparency on the canvas element. This will make all 3D models that use alpha textures work better with alpha cutoff.
        -   Note that setting to `true` will make all iframe forms unusable.
        -   Defaults to `false`.

    -   Added the ability to store universe data in CassandraDB.

        -   Note that support for CassandraDB is experimental and probably won't be supported in the future.
        -   If the required environment variables are not specified, then Cassandra support will be disabled.
        -   Use the following environment variables to enable Cassandra support:
            -   `CASSANDRA_AWS_REGION` - This is the AWS region that the Amazon Keyspaces instance is hosted in.
            -   `CASSANDRA_CONTACT_POINTS` - This is the comma-separated list of hostnames that the Cassandra client to connect to on first load. (Required if `CASSANDRA_AWS_REGION` is not specified)
            -   `CASSANDRA_LOCAL_DATACENTER` - This is the name of the data center that the AUX Server is booting up in. (Required if `CASSANDRA_AWS_REGION` is not specified)
            -   `CASSANDRA_KEYSPACE` - This is the name of the keyspace that should be used by the client. (Required for Cassandra)
            -   `CASSANDRA_CREATE_KEYSPACE` - This is a `true`/`false` value indicating whether the client should create the keyspace if it doesn't exist. (Optional)
            -   `CASSANDRA_CERTIFICATE_AUTHORITY` - This is the path to the public key file (PEM format) that should be used. Only required if connecting to a Cassandra server which uses a self-signed certificate.

-   :bug: Bug Fixes
    -   Fixed an issue where loading a GLTF would error if the bot was destroyed while the GLTF was loading.

## V1.1.0

### Date: 4/27/2020

### Changes:

-   :rocket: Improvements

    -   Added the `autoSelect` property to the options in `player.showInput()` and `player.showInputForTags()`.
        -   When set to true, the text in the input box will be automatically selected when the box is displayed.
    -   Made the VR pointer line draw all the way to the bot or grid that it is pointing at.
    -   Changed the layout of sizing of the history bots so that they are easy to distinguish from each other and the labels fit on the bot.
    -   Added the `#auxScaleMode` tag to control how a custom mesh is scaled to fit inside a bot. It supports the following options:
        -   `fit` - The mesh is scaled to fit inside the bot's unit cube. (default)
        -   `absolute` - The mesh uses whatever scale it originally had.

-   :bug: Bug Fixes
    -   Fixed LODs in VR.
        -   There were two issues:
            -   The first was that we were using the incorrect camera for LOD calculations.
            -   The second was that Three.js's Sphere implementation incorrectly calculated the sphere size for perspective cameras.
    -   Fixed some issues with the `destroy()` function where it improperly handled non-bot objects.
    -   Fixed an issue with builder where extra tags would be added to new blank bots.
    -   Fixed an issue with menu bots where they would not send `@onAnyBotClicked` shouts.

## V1.0.27

### Date: 4/22/2020

### Changes:

-   :rocket: Improvements

    -   Added the `player.share(options)` function.
        -   This will trigger the device's social share capabilities to share the given URL or text.
        -   Note that this only works on Android and iOS phones and only works in response to some user action like a click.
        -   `options` is an object with at least one of the following properties:
            -   `url` - The URL to share. (optional)
            -   `text` - The text to share. (optional)
            -   `title` - The title of the document that is being shared. (optional)
    -   Added the `auxLabelAlignment` tag.
        -   Note that this value affects menu bots as well.
        -   Possible values are:
            -   `center` - Aligns the text in the center of the label. (default)
            -   `left` - Aligns the text to the left of the label.
            -   `right` - Aligns the text to the right of the label.
    -   Improved the `auxPointable` tag to affect whether iframes are interactable.

-   :bug: Bug Fixes

    -   Fixed an issue with the iframe form where non square scales would not resize the clickable area of the iframe.

## V1.0.26

### Date: 4/21/2020

### Changes:

-   :boom: Breaking Changes

    -   Changed how universes from other auxPlayers are specified.
        -   This affects the `player.loadUniverse()` function and the `BotManager` API.
        -   Previously, you could load a universe from a different auxPlayer by using a universe ID like:
            -   `otherAuxPlayer.com/*/universeToLoad`
        -   Now, you can load a universe by simply using its full URL. Like this:
            -   `https://otherAuxPlayer.com?auxUniverse=universeToLoad`
        -   Note that this does not affect loading universes from the same auxPlayer. If you pass a universe ID that is not a URL then it will load that particular universe from same auxPlayer.
            -   e.g. `player.loadUniverse("myUniverse")`

*   :rocket: Improvements

    -   Improved the `player.showInputForTag()` modal.
        -   Removed the "Save" and "Cancel" buttons. The tag will be saved automatically.
        -   Hid the modal title when none is provided in the options.
        -   Made the text box in the modal auto-focus.
        -   Made the show/hide animations happen quicker.
    -   Added the `player.showInput(value, options)` function.
        -   Shows an input modal but without requiring a bot and a tag.
        -   Returns a [Promise](https://web.dev/promises/) that resolves with the final value when the input modal is closed.
        -   The function accepts two arguments:
            -   `value` is a string containing the value that should
            -   `options` is an object that takes the same properties that the options for `player.showInputForTag()` takes.
    -   Added the ability to use the [`await` keyword](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await) in scripts.
        -   `await` tells the system to wait for a promise to finish before continuing.
        -   This makes it easier to write scripts which deal with tasks that take a while to complete.
    -   Improved Builder to support opening a single bot in a new tab and changed its hover label from "menu" to "|||".

-   :bug: Bug Fixes

    -   Fixed an issue where it was impossible to load an AUX over HTTPS from a UI that was loaded over HTTP.

## V1.0.25

### Date: 4/15/2020

### Changes:

-   :boom: Breaking Changes

    -   Renamed the `billboardZ` auxOrientationMode option to `billboardTop`.

-   :rocket: Improvements

    -   Added the `server.loadErrors(bot, tag)` function to make loading error bots from the error space easy.
        -   `bot` is the bot or bot ID that the errors should be loaded for.
        -   `tag` is the tag that the errors should be loaded for.
    -   Added the `server.destroyErrors()` function to clear all the errors in the universe.
    -   Added the `billboardFront` auxOrientationMode option to billboard the front of a bot instead of its top.
    -   Added the ability to set `auxFormAnimation` to an array.
        -   When set, the list of animations will play in sequence.
        -   The last animation will loop forever until changed.
    -   Added the `experiment.localFormAnimation(bot, animation)` function to play an animation locally.
        -   It will interrupt and restore whichever animation is already playing on the bot.

-   :bug: Bug Fixes

    -   Fixed an issue where tags that were added via the sheet would not be recognized by the `getMod()` function.

## V1.0.24

### Date: 4/14/2020

### Changes:

-   :rocket: Improvements

    -   Added a button on the sheet code editor to show errors that the script has run into.
        -   It is very basic at the moment. There are no line/column numbers, no timestamps, and no way to clear the errors.
        -   Errors are automatically pulled from error space and queried based on the following tags:
            -   `auxError` must be `true`
            -   `auxErrorBot` must be the ID of the bot whose script is in the editor.
            -   `auxErrorTag` must be the name of the tag that is being edited.
        -   The following tags are displayed for each error:
            -   `auxErrorName` is the name of the error that occurred.
            -   `auxErrorMessage` is the message that the error contained.

-   :bug: Bug Fixes

    -   Fixed the color encoding of sprites to use sRGB instead of linear.
    -   Fixed an issue where atoms would be sorted improperly because their causes were improperly treated as different.

## V1.0.23

### Date: 4/12/2020

### Changes:

-   :rocket: Improvements

    -   Improved the handling of `setTimeout()` and `setInterval()` to support creating, updating, and deleting bots while in a callback.

-   :bug: Bug Fixes

    -   Fixed an issue that prevented events produced while in a task from being dispatched.

## V1.0.22

### Date: 4/11/2020

### Changes:

-   :boom: Breaking Changes

    -   The `player.inSheet()` function has been changed to return whether the player bot has a dimension in their `auxSheetPortal`.
        -   Previously, it was used to determine if the player was inside auxBuilder (which no longer exists).
    -   Removed assignment formulas.
        -   Assignment formulas were a special kind of formula where the tag value would be replaced with the result of the formula.
        -   They were removed due to lack of use in addition to other means of achieving the same result being available.
    -   Semantics of `@onUniverseAction` have changed.
        -   Previously, `@onUniverseAction` was run before any particular action was executed but the actions that were dispatched from `@onUniverseAction` were run after the evaluated actions. This led to a scenario in which a `@onUniverseAction` call could overwrite values that were updated by an action that had not been checked yet.
        -   Now, all actions dispatched by `@onUniverseAction` are executed before the action that is being evaluated. This makes the behavior of the data produced by `@onUniverseAction` mirror the runtime behavior of `@onUniverseAction`.

-   :rocket: Features

    -   Added a new runtime for scripts and formulas.
        -   This new runtime is much faster than the previous system and lets us provide features that were not possible before.
        -   _Should_ work exactly the same as the previous system. (There might be a couple of tricky-to-reproduce bugs)
        -   Now supports `setTimeout()` and `setInterval()`.
            -   This lets you write your own custom game loop if you want.
            -   Note that the script energy will only be restored if a user action triggers a shout.
        -   Paves the way for future functionality (not guarenteed):
            -   Change notifications (`@onBotChanged`, `@onBotTagChanged()`, etc.)
            -   Asynchronous functions instead of `responseShout`. (e.g. `const response = await webhook.post("https://example.com", data)`)
    -   Added the `error` space.
        -   The `error` space contains bots that represent errors that have occurred scripts in a universe.
        -   Unlike other spaces, the `error` space does not load all of its bots into the universe automatically.
        -   Instead, they have to be requested via a search query. These queries filter bots by tag/value pairs.
        -   Currently, `error` space is only used for storing errors and there is no way to load bots from the space.
        -   In the future, we will add the ability to load errors via scripts as well as display them in the sheet.
    -   Changed the renderer to output colors in the sRGB color space instead of linear.

-   :bug: Bug Fixes

    -   Fixed an issue where a shout argument might be recognized as a bot even though it isn't.
    -   Fixed an issue where a shout argument with a custom prototype would be overridden.
    -   Fixed a bug in three.js's LegacyGLTFLoader where it was using an old API.

## V1.0.21

### Date: 3/30/2020

### Changes:

-   :bug: Bug Fixes

    -   Fixed an issue where the proxy system would interfere with requests that specified custom HTTP headers.

## V1.0.20

### Date: 3/20/2020

### Changes:

-   :rocket: Improvements

    -   Added the `#auxPointable` tag to determine whether a bot can interact with pointers.
        -   Defaults to `true`.
        -   When `false`, the bot won't be clickable or hoverable and will not receive drop events.
        -   Depending on the `#auxPositioningMode` it is still possible to stack bots on top of it though.
    -   Added the `@onFocusEnter`, `@onFocusExit`, `@onAnyFocusEnter` and `@onAnyFocusExit` listen tags.
        -   These are triggered when a bot is directly in the center of the screen.
        -   Uses the `#auxFocusable` tag to determine whether a bot is focusable.
        -   `that` is an object with the following properties:
            -   `dimension` - The dimension that the the bot was (un)focused in.
            -   `bot` - The bot that was (un)focused.
    -   Added the `nothing` aux form.
        -   Does exactly what it seems. A bot with the `nothing` form has no shape and is unable to be clicked, hovered, or focused.
        -   Labels still work though which makes it convienent for adding extra labels around the dimension.
    -   Added the `#auxPortalShowFocusPoint` tag.
        -   Shows a small sphere in the portal where the portal camera will orbit around.

-   :bug: Bug Fixes

    -   Fixed an issue where LODs would flicker upon changing the bot form by ensuring consistent sizing for the related bounding boxes.
    -   Fixed an issue with panning that would cause the camera orbiting position to be moved off the ground.

## V1.0.19

### Date: 3/19/2020

### Changes:

-   :rocket: Improvements

    -   Added the ability to modify tags directly on bots in `that`/`data` values in listeners.
        -   Allows doing `that.bot.tags.abc = 123` instead of `setTag(that.bot, "abc", 123)`.
    -   Added the `@onGridUp` and `@onGridDown` listeners.
        -   `that` is an object with the following properties:
            -   `dimension` - The dimension that the grid was clicked in.
            -   `position` - The X and Y position that was clicked.
    -   Changed the Level-Of-Detail calculations to use the apparent size of a bot instead of its on-screen size.
        -   Apparent size is the size the bot would appear if it was fully on screen.
        -   Under the new system, the LOD of a that is on screen bot will only change due to zooming the camera. Bots that are fully off screen will always have the minimum LOD.
    -   Added the `@onFileUpload` listener.
        -   `that` is an object with the following properties:
            -   `file` is an object with the following properties:
                -   `name` - The name of the file.
                -   `size` - The size of the file in bytes.
                -   `data` - The data contained in the file.
        -   See the documentation for more information.
    -   Improved the `player.importAux()` function to support importing directly from JSON.
        -   If given a URL, then `player.importAux()` will behave the same as before (download and import).
        -   If given JSON, then `player.importAux()` will simply import it directly.

-   :bug: Bug Fixes
    -   Fixed an issue where the camera matrix was being used before it was updated.

## V1.0.18

### Date: 3/18/2020

### Changes:

-   :rocket: Improvements

    -   Added LOD triggers based on virtual distance.
        -   `@onMaxLODEnter`, `@onMinLODEnter`, `@onMaxLODExit`, `@onMinLODExit` are new listeners that are called when the Max and Min Level-Of-Detail states are entered and exited. There are also "any" versions of these listeners.
            -   `that` is an object with the following properties:
                -   `bot` - The bot that entered/exited the LOD.
                -   `dimension` - The dimension that the LOD was entered/exited in.
        -   The `#auxMaxLODThreshold` and `#auxMinLODThreshold` tags can be used to control when the LODs are entered/exited.
            -   They are numbers between 0 and 1 representing the percentage of the screen that the bot needs to occupy.
            -   The Max LOD is entered when the bot occupies a larger percentage of the screen than the max threshold value.
            -   The Min LOD is entered when the bot occupies a smaller percentage of the screen than the min threshold value.
        -   Only active on bots that specify a listener or threshold value for LODs.

-   :robot: Builder Improvements

    -   Changed the labeling and ordering of several menu items in the menus.
    -   Removed tips from the chat bar.
    -   Removed the "Apply Hover Mod" and "Apply Click Mod" menu items.
    -   Changed Builder to not move when clicking the grid to clear the menu.
    -   Added a "Clear Universe" option to the Builder Egg. Selecting this will create a history mark and then delete every bot in the universe. (it will even delete bots that are marked as not destroyable)

-   :bug: Bug Fixes

    -   Fixed an issue with hovering billboarded bots where their rotation would sometimes be reset which would cause the hover exit and enter events to be continually triggered.
    -   Fixed an issue where creating a history mark would clear changes that were made during the history mark creation.

## V1.0.17

### Date: 3/17/2020

### Changes:

-   :boom: Breaking Changes

    -   Renamed and removed several `auxAnchorPoint` values.
        -   Renamed `centerFront` to `front`.
        -   Renamed `centerBack` to `back`.
        -   Removed `bottomFront`, `bottomBack`, `topFront`, and `topBack`.

-   :rocket: Improvements

    -   Added the ability to specify an array of 3 numbers as the `#auxAnchorPoint` to use a custom offset.

-   :bug: Bug Fixes
    -   Fixed `billboardZ` to rotate with the Y axis of the bot facing upwards.

## V1.0.16

### Date: 3/16/2020

### Changes:

-   :boom: Breaking Changes

    -   Both sprites and iframes now face upwards by default.
    -   `#auxAnchorPoint` has been changed to move the bot form inside of its virtual spacing box.
        -   Previously, both the virtual box and the bot form was moved to try and preserve the absolute positioning of the bot form when changing anchor points.
        -   Now, only the bot form is moved to ensure the correctness of the resulting scale and rotation calculations.
    -   `#auxOrientationMode`
        -   Renamed the `billboardX` option to `billboardZ`.
    -   Changed iframes forms to not support strokes.

-   :rocket: Improvements

    -   Added the following options for `#auxAnchorPoint`
        -   `centerFront` - Positions the bot form such that the center of the form's front face is at the center of the virtual bot.
        -   `centerBack` - Positions the bot form such that the center of the form's back face is at the center of the virtual bot.
        -   `bottomFront` - Positions the bot form such that the bottom of the form's front face is at the center of the virtual bot.
        -   `bottomBack` - Positions the bot form such that the bottom of the form's back face is at the center of the virtual bot.
        -   `top` - Positions the bot form such that the top of the form is at the center of the virtual bot.
        -   `topFront` - Positions the bot form such that the top of the form's front face is at the center of the virtual bot.
        -   `topBack` - Positions the bot form such that the top of the form's back face is at the center of the virtual bot.

-   :bug: Bug Fixes
    -   Fixed issues with scale and rotation when `#auxAnchorPoint` is set to `center`.
    -   Fixed sprite billboarding issues when looking straight down at them.
    -   Fixed an issue where the wrong Z position tag of a bot was used for calculating how bots stack.
    -   Fixed an issue where the bot stroke was being considered for collision detection. This caused bots with strokes to have a much larger hit box than they should have had.

## V1.0.15

### Date: 3/13/2020

### Changes:

-   :boom: Breaking Changes

    -   Replaced all of the experimental iframe tags with the `iframe` `#auxForm`.
        -   `auxIframe`
        -   `auxIframeX`
        -   `auxIframeY`
        -   `auxIframeZ`
        -   `auxIframeSizeX`
        -   `auxIframeSizeY`
        -   `auxIframeRotationX`
        -   `auxIframeRotationY`
        -   `auxIframeRotationZ`
        -   `auxIframeElementWidth`
        -   `auxIframeScale`
    -   Sprites no longer automatically rotate to face the player. You instead have to set `#auxOrientationMode` to `billboard`.

-   :rocket: Improvements

    -   Improved `@onPlayerPortalChanged` to support `auxLeftWristPortal` and `auxRightWristPortal`.
    -   Moved the left and right wrist portals to the top of the wrist instead of the bottom.
    -   Added the `iframe` option for `#auxForm`.
        -   `iframe` has two subtypes:
            -   `html` - This `#auxFormSubtype` displays the HTML in `#auxFormAddress` in the iframe. (Default)
            -   `src` - This `#auxFormSubtype` displays the URL in `#auxFormAddress` in the iframe.
        -   In order to enable interactivity with the loaded website, the bot will only be draggable at the very bottom of the panel.
    -   Added the `#auxAnchorPoint` and `#auxOrientationMode` tags.
        -   Works on all bot forms.
        -   `#auxAnchorPoint` determines the point that the bot scales and rotates around.
            -   Possible values are:
                -   `bottom` - The bot rotates and scales around its bottom point. (Default)
                -   `center` - The bot rotates and scales around its center point.
        -   `#auxOrientationMode` determines how the bot rotates.
            -   Possible values are:
                -   `absolute` - Rotation is taken from the dimension rotation values. (Default)
                -   `billboard` - The bot rotates automatically to face the player.
                -   `billboardX` - The bot rotates left and right automatically to face the player.
                -   `billboardZ` - The bot rotates up and down automatically to face the player.
    -   Improved drag and drop interactions to calculate intersections with other bots instead of just using grid positioning.
        -   This makes it easier drop a bot onto another specific bot.
        -   Can be controlled with the `#auxPortalPointerCollisionMode` tag on a portal config.
            -   Possible values are:
                -   `world` - The mouse pointer collides with other bots in the world when being dragged. (Default)
                -   `grid` - The mouse pointer ignores other bots in the world when being dragged.
    -   Added the ability to animate meshes.
        -   By default the first animation will play if available.
        -   You can control which animation is played using the `#auxFormAnimation` tag.
            -   Set to a string to play an animation by name. (Case sensitive)
            -   Set to a number to play an animation by index.
            -   Set to `false` to stop animating.

-   :robot: Builder Improvements

    -   Added a "Scan" menu item to the builder menu that opens the QR Code scanner to let you import an AUX or mod.
        -   Scanning a URL that ends with `.aux` will try to download the file at the URL and import it as an AUX file.
        -   Scanning some JSON will put Builder into clone mode with the JSON as a mod.
    -   Added a hover state to Builder that changes its label to "menu".
    -   Changed the label of the Builder Egg to "ab-1 config".

-   :book: Documentation

    -   Added documentation for the wrist portals and their related config bot tags.

-   :bug: Bug Fixes
    -   Fixed `player.downloadUniverse()` to only include bots from the shared space.
    -   Fixed an issue where sprites were not clickable or draggable in VR.

## V1.0.14

### Date: 3/6/2020

### Changes:

-   :rocket: Features

    -   Added wrist portals for WebXR
        -   `#auxLeftWristPortal` is attached to the left controller and `#auxRightWristPortal` is attached to the right controller.
        -   You can configure these portals using the `#auxLeftWristPortalConfigBot` and `#auxRightWristPortalConfigBot` tags.
        -   The portals are hidden until you look at them. They are placed underneath your wrist like a wristwatch.
        -   The following tags are available for configuration:
            -   `#auxPortalGridScale` - Changes the size of the grid for the portal. (Defaults to `0.025` for wrist portals)
            -   `#auxWristPortalHeight` - The height of the portal in grid elements. (Defaults to `6`)
            -   `#auxWristPortalWidth` - The width of the portal in grid elements. (Defaults to `6`)
        -   There are a couple of known issues with wrist portals:
            -   3D Text is sometimes improperly aligned.
            -   Lines/Arrows/Walls also have alignment issues.

-   :bug: Bug Fixes
    -   Fixed an issue that caused the inventory to not appear if it was changed multiple times during the same frame.
    -   Fixed an issue that caused the `#auxPortalGridScale` tag to function improperly.

## V1.0.13

### Date: 3/2/2020

### Changes:

-   :bug: Bug Fixes
    -   Fixed an issue that caused all the input to not work.

## V1.0.12

### Date: 3/2/2020

### Changes:

-   :bug: Bug Fixes
    -   Fixed an issue with loading skinned meshes.
    -   Fixed an issue that prevented VR from working when sprites were in the scene.
    -   Fixed an issue where an error in one script would cause other scripts to be skipped.
    -   Fixed an issue where invisible bots are excluded from the colliders list.

## V1.0.11

### Date: 2/27/2020

### Changes:

-   :bug: Bug Fixes
    -   Fixed a configuration value that enabled the 3D debug mode by default.

## V1.0.10

### Date: 2/27/2020

### Changes:

#### :rocket: Improvements

-   Added Basic WebXR Support

    -   This replaces the original WebVR and WebXR support.
    -   Supports both the Oculus Quest and Chrome 80+ on Android.
    -   Supports all pointer events (click, drag, hover).
    -   The `player.device()` function returns whether AR/VR are supported.
    -   The `player.enableAR()` and `player.enableVR()` functions are used to jump into AR/VR.
    -   The world is placed on the ground (if supported by the device) and bots are 1 meter cubed by default.
    -   When using a controller, dragging a bot with `#auxPositioningMode` set to `absolute` will move it in free space.

-   :bug: Bug Fixes
    -   Fixed several issues with using numbers for the `auxUniverse` and `auxPagePortal` query parameters.
    -   Fixed an issue that would cause a service worker to fail to update because an external resource could not be fetched.
    -   Fixed an issue that would cause a stack overflow error when too many uncommitted atoms are loaded.

## V1.0.9

### Date: 2/21/2020

### Changes:

#### :rocket: Improvements

-   The "Create Empty Bot" button is now hidden when opening the sheet for a single bot.

#### :robot: Builder Improvements

-   Re-labeled the "Copy" menu item to "Copy to Clipboard".
-   Re-labeled the "Make Clone" menu item to "Clone".

#### :bug: Bug Fixes

-   Fixed an issue with `getBots(tag, value)` that caused falsy values (like `0` or `false`) to return all bots with the given tag.
-   Fixed an issue where the progress bar's position would only be updated if the progress bar value changed.

## V1.0.8

### Date: 2/20/2020

### Changes:

#### :rocket: Improvements

-   Added the `@onPaste` listener which is triggered when some text is pasted into an AUX.
    -   `that` is an object with the following properties:
        -   `text` - the text that was pasted.

#### :robot: Builder Improvements

-   Changed all the menu items to use normal labels instead of the chat commands.
-   Added a menu item to open a bot directly in the sheet.
-   Added a menu item to copy a bot to the clipboard.
-   Pasting a bot/mod when builder is in the dimension will now put builder into clone mode with the copied bot/mod.
-   Moving builder when builder is in clone mode will now also move the clone.
-   Cloning a bot with a custom scale will now make builder large enough to cover the entire bot.
-   Builder will now automatically hide when the sheet is opened.

## V1.0.7

### Date: 2/19/2020

### Changes:

#### :bug: Bug Fixes

-   Fixed an issue where the hint text for a function was being clipped.
-   Fixed an issue with uploading .aux files that were downloaded from a previous version.
-   Fixed an issue with downloading .aux files in the wrong format.

## V1.0.6

### Date: 2/19/2020

### Changes:

#### :boom: Breaking Changes

-   Renamed `auxLabelAnchor` to `auxLabelPosition`.
-   Renamed `auxProgressBarAnchor` to `auxProgressBarPosition`.
-   Removed the `config` bot.
-   Moved the `#stripePublishableKey` and `#stripeSecretKey` tags from the config bot to the `player.checkout()` and `server.finishCheckout()` function options.
-   `@onUniverseAction` is now a shout.
-   Removed [poly.google.com](https://poly.google.com) support.
    -   To load meshes from poly.google.com, you must make the API requests manually.
    -   See https://casualos.com/home/google-poly-example for an example.

#### :rocket: Improvements

-   Added the `config`, `configTag`, and `tagName` variables.
    -   These variables are useful for creating values and scripts that are shared across multiple bots.
    -   The `config` variable is a shortcut for `getBot("#id", tags.auxConfigBot)`.
    -   The `tagName` variable is the name of the tag that the script is running in.
    -   The `configTag` variable is a shortcut for `config.tags[tagName]`.
-   Made the player menu full width on mobile devices.
-   Improved the sheet portal to load all bots when set to `true`, `id`, or `space`.

#### :bug: Bug Fixes

-   Made bots be hidden while their images are loading.
-   Improved the image loading logic to cache requests for the same URL.

## V1.0.5

### Date: 2/14/2020

### Changes:

#### :book: Documentation

-   Added docs for the `polyApiKey`, `stripePublishableKey`, and `stripeSecretKey` tags.
-   Added a "Player Bot Tags" section with a description of what the player tags do.

#### Other Changes

-   Added support for the webkit-specific versions of the [`requestFullscreen()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) function.
    -   This may enable support for fullscreen on iPad, but it also may do nothing.

## V1.0.4

### Date: 2/13/2020

### Changes:

#### :rocket: Features

-   Added the `player.requestFullscreenMode()` and `player.exitFullscreenMode()` functions.
    -   These functions allow jumping in and out of fullscreen, thereby hiding the browser UI controls.
-   Added the `apple-mobile-web-app-*` meta tags to support jumping into fullscreen mode when launching from a bookmark on the iOS home screen.
-   Added the ability to load GLTF and [poly.google.com](https://poly.google.com) meshes.
    -   To load a GLTF model from a URL:
        -   Set `#auxForm` to `mesh`.
        -   Set `#auxFormSubtype` to `gltf`.
        -   Set `#auxFormAddress` to the URL.
    -   To load a model from [poly.google.com](https://poly.google.com):
        -   Set `#auxForm` to `mesh`.
        -   Set `#auxFormSubtype` to `poly`.
        -   Set `#auxFormAddress` to the ID of the model.
-   Added the `face` property to the `@onDrag` and `@onAnyBotDrag` listen arguments.
    -   This is the same value that you would get in an `@onClick`.

#### :robot: Builder Improvements

-   Improved builder to draw a line to the selected bot.

#### :bug: Bug Fixes

-   Fixed positioning of `#auxLabelAnchor` and `#auxProgressBarAnchor` when the values were set to `left` or `right`.

## V1.0.3

### Date: 2/11/2020

### Changes:

#### :robot: Builder Improvements

-   Making a clone of a bot now puts builder into palette mode.
-   Dragging a bot into builder no longer changes builder's color to white.
-   Added the `.help` command to show a list of available commands.
-   Added the `.sleep` command to the helper builder menu.
-   Added the "Go to Builder Dimension` menu action.
-   Added a "Show Join Code" menu item to show a QR Code to quickly join.
-   Waking builder will automatically summon it to the current dimension.
-   Clicking in an empty space when builder is awake will summon him to the clicked space.
-   Made the main builder flat.
-   Builder is now enabled by default in new universes.
-   Added the "Restore Mark" menu item to restore history to the selected history mark.
-   Simplified a bunch of examples.

#### :rocket: Other Features

-   Added the `player.showJoinCode()` function to quickly show a QR Code to join a universe.
-   Made the chat bar auto-focus when it is first shown.

#### :bug: Bug Fixes

-   Fixed an issue that would cause the URL portal tag sync to break, this in turn also caused `@onPlayerPortalChanged` events to not be sent.
    -   This is also the issue that caused the inventory portal colors to not update.
-   Fixed an issue that would cause the tag autocomplete list to stop showing tags when an invalid tag was entered.

## V1.0.2

### Date: 2/10/2020

### Changes:

#### :bug: Bug Fixes

-   Fixed an issue where dragging normal bots was broken.

## V1.0.1

### Date: 2/10/2020

### Changes:

#### :bug: Bug Fixes

-   Fixed an issue with mouse input where dragging the mouse off the browser window would cause the dragging action to persist even when the mouse button is released.
-   Fixed an issue where sometimes a touch handler would be called twice due to event propagation. This would cause other touch events to be lost which would leave the input system in an unrecoverable state.
-   Fixed an issue where sometimes `player.replaceDragBot()` would not work for the entire session.

## V1.0.0

### Date: 2/7/2020

### Changes:

#### :robot: Builder Improvements

-   Renamed the `.summon` command to `.`.
-   Renamed the `.new builder` command to `.clone builder`
-   The Builder menu will now close automatically in the following scenarios:
    -   Any bot is clicked
    -   The grid is clicked
    -   A menu item is selected
    -   A chat command is sent
-   The Builder's cursor is now perfectly flat and is the same color as the Builder.
-   Renamed the default Builder to `ab-1`
-   Dragging a bot into Builder will cause Builder to expand to contain the bot and make Builder produce additional copies of the bot when dragged.
-   Added the `.list commands` command to show a HTML popup with a list of available commands.
-   Added the ability to change the color of the Builder.
-   Updated how hints are displayed in the chat bar.
-   Renamed several labels.

#### :rocket: Other Improvements

-   Moved the "Exit Sheet" button from the bottom of the sheet the top of the sheet. (next to the "Create Bot" button)
-   Added the ability to click a bot in the sheet to hide the sheet and warp to the clicked bot.
-   Added a notification that pops up when a bot ID is copied from the sheet.

#### :bug: Bug Fixes

-   Fixed an issue where destroying a bot during a shout would error if the destroyed bot also had a listener for the same shout.

## V0.11.27

### Date: 2/6/2020

### Changes:

#### :rocket: Features

-   Added an initial version of Builder.
    -   Builder is a bot that helps you build things in aux.
    -   Builder lives in the `auxBuilder` dimension and can be woken up by clicking it.
    -   Builder currently has the following chat commands:
        -   `.. [name]` - Wakes Builder with the given name. If the name is omitted, then the `b001` Builder will be woken.
        -   `.sleep` - Puts Builder to sleep.
        -   `.sheet [dimension]` - Opens the sheet to the given dimension. If the dimension is omitted, then the sheet will be opened for the current dimension.
        -   `.new bot` - Creates a new bot in the current dimension.
        -   `.download` - Downloads the entire universe.
        -   `.upload` - Shows the upload dialog.
        -   `.goto {dimension}` - Redirects the page portal to the given dimension.
        -   `.new universe {universeName}` - Creates a new universe with the given name and opens it in a new tab.
        -   `.show history` - Loads the history and goes to the `auxHistory` dimension.
        -   `.mark history` - Creates a new history mark for the current state.
        -   `.show docs` - Opens the documentation website in a new tab.
        -   `.summon` - Summons the Builder helper into the current dimension.
        -   `.new builder {name}` - Creates a clone of the current builder with the given name.
    -   Builder has a helper bot which will follow you around the universe.
        -   If you enter an empty dimension, the helper bot will automatically appear.
        -   If you enter a dimension that has a bot, you need to summon it using the `.summon` command.
        -   You can click on helper to show a menu of possible options.
        -   Dragging helper will give you a cursor that lets you teleport helper around or select other bots.
        -   Dragging another bot onto helper will turn helper into a pallete so when you drag helper it will make a clone of the other bot.
            -   Clicking helper will return it to normal.
-   Added hotkeys to show/hide the chat bar.
    -   Use the `~` key to show the char bar.
    -   Use the `3342` finger tap code on mobile to show the chat bar.
    -   Use a `5` finger tap on mobile to hide the chat bar.

#### :bug: Bug Fixes

-   Fixed an issue where creating a bot inside a shout would prevent the new bot from being modified by future shouts.
-   Fixed an issue where creating and then updating a bot that was not in the shared space would cause all the updates to be incorrectly routed to the shared space and dropped.

## V0.11.26

### Date: 2/4/2020

### Changes:

#### :book: Documentation

-   Added documentation for the following actions:
    -   `player.getCurrentUniverse()`
    -   `player.getCurrentDimension()`
    -   `player.getInventoryDimension()`
    -   `player.getMenuDimension()`
    -   `player.goToURL()`
    -   `player.openURL()`
    -   `player.getBot()`
    -   `player.playSound()`
    -   `player.showHtml()`
    -   `player.hideHtml()`
    -   `player.tweenTo()`
    -   `player.moveTo()`
    -   `player.openQRCodeScanner()`
    -   `player.closeQRCodeScanner()`
    -   `player.showQRCode()`
    -   `player.hideQRCode()`
    -   `player.openBarcodeScanner()`
    -   `player.closeBarcodeScanner()`
    -   `player.showBarcode()`
    -   `player.hideBarcode()`
    -   `player.loadUniverse()`
    -   `player.unloadUniverse()`
    -   `player.importAUX()`
    -   `player.hasBotInInventory()`
    -   `player.showInputForTag()`
    -   `player.checkout()`
    -   `player.openDevConsole()`
    -   `server.finishCheckout()`
    -   `server.loadFile()`
    -   `server.saveFile()`
    -   `server.shell()`
    -   `server.backupToGithub()`
    -   `server.backupAsDownload()`
    -   `superShout()`
    -   `action.perform()`
    -   `action.reject()`
    -   `getBotTagValues()`
    -   `remote()`
    -   `webhook()`
    -   `webhook.post()`
    -   `byMod()`
    -   `neighboring()`
    -   `either()`
    -   `not()`
    -   `removeTags()`
    -   `subtractMods()`
    -   `getTag()`
    -   `setTag()`
    -   `math.sum()`
    -   `math.avg()`
    -   `math.abs()`
    -   `math.sqrt()`
    -   `math.stdDev()`
    -   `math.randomInt()`
    -   `math.random()`
-   Removed the following functions:
    -   `renameTagsFromDotCaseToCamelCase()`
    -   `server.sayHello()`
    -   `server.echo()`

#### :bug: Bug Fixes

-   Fixed an issue that prevented `changeState()` from working on bots which were provided from a `that`/`data` argument.

## V0.11.25

### Date: 1/31/2020

### Changes:

#### :boom: **Breaking Changes**

-   Replaced the `@onPlayerEnterDimension` listener with `@onPlayerPortalChanged`.
    -   `@onPlayerPortalChanged` is called whenever any portal changes whereas `@onPlayerEnterDimension` was only called for `auxPagePortal`.
    -   Additionally, this fixes some of the issues that `@onPlayerEnterDimension` ran into.
-   Changed the Webhook URLs to the new URL scheme.
    -   Instead of `https://auxplayer.com/{dimension}/{universe}` you should use `https://auxplayer.com/webhook?auxUniverse={universe}`

#### :rocket: Features

-   Added the ability to click a Bot ID in the sheet to copy it.

#### :bug: Bug Fixes

-   Fixed an issue that prevented the portals from reverting to default values if the config bot for the portal was cleared.

## V0.11.24

### Date: 1/31/2020

### Changes:

#### :boom: **Breaking Changes**

-   Renamed the following tags:
    -   `_auxUserDimension` -> `auxPagePortal`
    -   `_auxUserInventoryDimension` -> `auxInventoryPortal`
    -   `_auxUserMenuDimension` -> `auxMenuPortal`
    -   `_auxUserUniverse` -> `auxUniverse`
    -   `auxDimensionColor` -> `auxPortalColor`
    -   `auxDimensionLocked` -> `auxPortalLocked`
    -   `auxDimensionRotatable` -> `auxPortalRotatable`
    -   `auxDimensionPannable` -> `auxPortalPannable`
    -   `auxDimensionPannableMaxX` -> `auxPortalPannableMaxX`
    -   `auxDimensionPannableMaxY` -> `auxPortalPannableMaxY`
    -   `auxDimensionPannableMinX` -> `auxPortalPannableMinX`
    -   `auxDimensionPannableMinY` -> `auxPortalPannableMinY`
    -   `auxDimensionZoomable` -> `auxPortalZoomable`
    -   `auxDimensionZoomableMax` -> `auxPortalZoomableMax`
    -   `auxDimensionZoomableMin` -> `auxPortalZoomableMin`
    -   `auxDimensionPlayerZoom` -> `auxPortalPlayerZoom`
    -   `auxDimensionPlayerRotationX` -> `auxPortalPlayerRotationX`
    -   `auxDimensionPlayerRotationY` -> `auxPortalPlayerRotationY`
    -   `auxDimensionGridScale` -> `auxPortalGridScale`
    -   `auxDimensionSurfaceScale` -> `auxPortalSurfaceScale`
    -   `auxDimensionInventoryHeight` -> `auxInventoryPortalHeight`
    -   `auxDimensionInventoryResizable` -> `auxInventoryPortalResizable`
    -   Removed all the inventory-specific dimension config tags in favor of the normal ones.
        -   e.g. `auxDimensionInventoryColor` is now just `auxPortalColor`
-   Removed the following tags:
    -   `aux._lastActiveTime`
    -   `_auxSelection`
    -   `aux.connected`
    -   `_auxUser`
    -   `auxUserUniversesDimension`
    -   `auxDimensionConfig`
-   Removed the following function:
    -   `player.isConnected()`
-   The `player.isInDimension()` function has been updated to check whether the page portal is showing the given dimension.
-   Dimensions can no longer be configured using the `auxDimensionConfig` tag.
    -   Instead of configuring dimensions, you must configure portals.
    -   Use the new `aux{type}PortalConfigBot` (like `auxPagePortalConfigBot`) tags to specify the bot that should configure the portal.
    -   The you can find a list of the possible tags under the "Portal Config Tags" header in the documentation.
-   Channel Designer is no more.
    -   In addition, the URL scheme has changed. Instead of `auxplayer.com/*{dimension}/{universe}` to get the sheet, you now have to specify the portals via URL query parameters. (e.g. `auxplayer.com?auxUniverse={universe}&auxSheetPortal={dimension}`)
    -   The possible portal values are:
        -   `auxSheetPortal` - Loads the sheet with the given dimension.
        -   `auxPagePortal` - Loads the normal 3D view with the given dimension.
        -   `auxMenuPortal` - Loads the menu with the given dimension.
        -   `auxInventoryPortal` - Loads the inventory with the given dimension.
    -   As a shortcut, you can go to `casualos.com/{dimension}/{universe}` and it will redirect you to `auxplayer.com?auxUniverse={universe}&auxPagePortal={dimension}` or `auxplayer.com?auxUniverse={universe}&auxSheetPortal={dimension}` depending on if you include the `*` for the dimension.

#### :rocket: Features

-   Added the `player.getPortalDimension(portal)` function.
    -   `portal` is a string with the name of the portal. Can be one of the following options:
        -   `page` - Gets the `auxPagePortal` tag.
        -   `inventory` - Gets the `auxInventoryPortal` tag.
        -   `menu` - Gets the `auxMenuPortal` tag.
        -   `sheet` - Gets the `auxSheetPortal` tag.
        -   `universes` - Gets the `auxUniversesPortal` tag.
        -   You can also give it a tag that ends with `"Portal"` to get that tag directly. (e.g. `auxPagePortal` will return `auxPagePortal`)
-   Added the `player.getDimensionalDepth(dimension)` function.
    -   `dimension` is the dimension that should be searched for.
    -   Returns the distance between the player bot and the given dimension.
        -   A return value of `0` means that the player bot is in the given dimension.
        -   A return value of `1` means that the player bot is viewing the given dimension through a portal.
        -   A return value of `-1` means that the player bot cannot access the given dimension at this moment.
-   Added the ability to show the sheet in auxPlayer by setting the `auxSheetPortal` tag on the player bot.

#### :bug: Bug Fixes

-   Fixed an issue where the inventory camera would be placed at an impossible location if the inventory was hidden during startup.
-   Fixed an issue with the inventory where setting `auxInventoryPortal` to null or `undefined` would not hide it.
-   Fixed an issue where setting a dimension tag to a number would place the bot in the dimension.
-   Fixed an issue where tag autocomplete results would become duplicated after closing and reopening the sheet.

## V0.11.23

### Date: 1/23/2020

### Changes:

#### :boom: **Breaking Changes**

-   Renamed the `player.inDesigner()` function to `player.inSheet()`.
-   Changed the `player.showChat(placeholder)` function to set the placeholder of the chat bar instead of the prefill.
-   Removed the ability to trigger a listener by clicking the play button in the code editor.
-   Removed the side menu from auxPlayer.
-   Removed [sharp](https://github.com/lovell/sharp) to allow us to make ARM builds on macOS.

#### :rocket: Features

-   Added the ability to specify an options object when calling `player.showChat(options)`.
    -   `options` is an object with the following properties:
        -   `placeholder` - The placeholder. Will override the existing placeholder. (optional)
        -   `prefill` - The prefill. Will only be set if there is no text already in the chat bar. (optional)
-   Added the ability to click the `id` tag in the sheet to load all the bots.
-   Added the ability to use the browser back button in the sheet.
-   Added the version number to the loading popup.
-   Added the `player.version()` function which gets information about the current version number.
    -   Returns an object with the following properties:
        -   `hash` - The Git hash that the build was made from.
        -   `version` - The Git tag that the build was made from.
        -   `major` - The major number of the build.
        -   `minor` - The minor number of the build.
        -   `patch` - The patch number of the build.
-   Improved the chat bar to remove focus from the input box when the "Send Message" button is clicked/tapped.
    -   This should cause the on-screen keyboard to automatically close.
-   Improved the menu positioning so that it will appear at the bottom of the screen when the inventory is hidden.
-   Added the ability to resize the code editor window.
-   Added the `player.device()` function which gets information about the current device.
    -   Returns an object with the following properties:
        -   `supportsAR` - Whether AR is supported.
        -   `supportsVR` - Whether VR is supported.
-   Added the `player.enableAR()` and `player.disableAR()` functions.
-   Added the `player.enableVR()` and `player.disableVR()` functions.

#### :bug: Bug Fixes

-   Fixed an issue where hidden tags would not get a button to toggle their visiblity in the sheet.
-   Fixed an issue where the `space` tag in the sheet would sometimes show an incorrect value.
-   Fixed an issue where sometimes AUX would crash when multiple tabs were open due to a race condition.
-   Fixed an issue where bots from the history space would not be findable in scripts.

## V0.11.22

### Date: 1/16/2020

### Changes:

-   **Breaking Changes**
    -   Changed player bots to use the `tempLocal` space.
        -   This means that refreshing the page won't pollute the universe with a ton of extra bots.
    -   `player.loadUniverse()` will now create bots in the `tempLocal` space.
        -   Previously they were created in the `shared` space.
-   Improvements
    -   Added the ability to create, load, and restore version marks.
        -   The `player.markHistory(options)` function creates a history mark for the current version.
            -   `options` is an object with the following properties:
                -   `message` - The message that the new mark should have.
        -   The `player.browseHistory()` function loads the `history` space with all the marks that the universe has.
        -   The `player.restoreHistoryMark(mark)` function restores the state in the given mark to the universe.
            -   `mark` - The bot or bot ID of the mark that should be restored.
        -   The `player.restoreHistoryMarkToUniverse(mark, universe)` function restores the state in the given mark to the given universe.
            -   `mark` - The bot or bot ID of the mark that should be restored.
            -   `universe` - The universe that the mark should be restored to.
    -   Changed the CORS settings to allow access from any origin.

## V0.11.21

### Date: 1/14/2020

### Changes:

-   **Breaking Changes**
    -   Renamed the `player.showUploadUniverse()` function to `player.showUploadAuxFile()`.
-   Improvements
    -   Added the `@onAnyCreate` shout listener.
        -   `that` is an object with the following properties:
            -   `bot` - The bot that was created.

## V0.11.20

### Date: 1/13/2020

### Changes:

-   **Breaking Changes**
    -   Renamed context to dimension.
        -   All the `auxContext*` tags have been renamed to `auxDimension*`.
        -   Listeners like `@onDrop`, `@onModDrop`, `@onClick`, etc. now have a `dimension` property in the `data` argument instead of `context`.
        -   The `@onPlayerEnterContext` listener has been renamed to `@onPlayerEnterDimension`.
        -   The `_auxUserContext`, `_auxUserMenuContext`, `_auxUserInventoryContext`, and `_auxUserChannelsContext` have been renamed to use dimension instead of context.
    -   Renamed channel to universe.
        -   All the `auxChannel*` tags have been renamed to `auxUniverse*`.
        -   The `_auxUserChannelsContext` tag has been renamed to `_auxUserUniversesDimension`.
        -   The `_auxUserChannel` tag has been renamed to `_auxUserUniverse`.
        -   The `player.setupChannel()` function has been renamed to `player.setupUniverse()`.
        -   The `player.loadChannel()` and `player.unloadChannel()` functions have been renamed to `player.loadUniverse()` and `player.unloadUniverse()`.
        -   The `player.getCurrentChannel()` function has been renamed to `player.getCurrentUniverse()`.
        -   The `setup_channel` action type has been renamed to `setup_universe`.
        -   The `@onChannel*` listen tags have been renamed to `@onUniverse*`.
            -   Also the `channel` property in the `data` argument has been renamed to `universe`.
    -   Renamed the `auxDimensionRotation` (`auxContextRotation`) tags to `auxDimensionOrientation`.
    -   You no longer need to define a dimension bot (context bot) in order to view a dimension in auxPlayer.
        -   You can still configure a dimension using the `auxDimensionConfig` tag (renamed from `auxContext`).
    -   Channel Designer is no more!
        -   It has been replaced with the "sheet dimension" (bot table).
        -   You can show _any_ dimension in the sheet by putting a `*` in front of the dimension name in the URL.
            -   e.g. `https://auxplayer.com/*home/example` if you wanted to view the `home` dimension in the sheet from the `example` universe.
            -   Going to just `*` will show all bots in the universe in the sheet. (which is very slow at the moment)
        -   You can also jump directly into auxPlayer by using the "Open dimension in auxPlayer" button that is next to the tag filters.
    -   Removed the `player.isDesigner()` function.
    -   Renamed `auxShape` to `auxForm`.
    -   Renamed `auxImage` to `auxFormAddress`.
-   Improvements
    -   Added the `player.showChat()` and `player.hideChat()` functions.
        -   These show/hide the chat bar in auxPlayer.
        -   Typing in the chat bar will trigger a `@onChatUpdated` shout with the text in the chat bar.
        -   Pressing Enter or clicking the send button on the chat bar will trigger a `@onChatEnter` shout with the text in the chat bar.
    -   Added the `@onChat` shout listener.
        -   Triggered when the user sends a message using the chat bar.
        -   `that` is an object with the following properties:
            -   `message` - The message that was sent.
    -   Added the `@onChatTyping` shout listener.
        -   Triggered when the user edits the text in the chat bar.
        -   `that` is an object with the following properties:
            -   `message` - The message that is in the chat bar after the user edited it.
    -   Added the `player.run(script)` function.
        -   `script` is the script text that should be executed.
        -   Works by sending a `run_script` action. This allows `@onUniverseAction()` listener to intercept and prevent scripts.
    -   Added the ability to click a tag in the bot table to teleport to that dimension.
    -   Added a play button to the right side of the code editor to run scripts for quick debugging.
    -   Added the `player.downloadBots(bots, filename)` function.
        -   The first parameter is an array of bots that should be downloaded.
        -   The second parameter is the name of the file that is downloaded.
    -   Added the `player.showUploadUniverse()` function.
        -   Shows a dialog that lets the user upload `.aux` files.
-   Other Changes
    -   Changed the "AUX Player" and "Channel Designer" tab titles to "auxPlayer".
    -   Removed the colored dots from tag labels in the bot table.
-   Bug Fixes
    -   `auxIframe` now supports URLs with `*` characters in them.
    -   Fixed an issue with the menu dimension that would cause items to remain even though a different dimension should be visible.

## V0.11.19

### Date: 12/31/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue where the "Create Empty Bot" button in the bot table was hidden when a mod was selected.

## V0.11.18

### Date: 12/30/2019

### Changes:

-   Improvements
    -   Showing hidden tags in the bot table will now also show the `shared` tag.
    -   Removed the multi-select button from the bot table.
    -   Removed the create context button from the bot table.
    -   Removed the clear search button from the bot table.
    -   Removed the "create mod from selection" button from the bot table.
    -   Added the ability to click/tap on a bot preview in the bot table to select a mod of it.
    -   Added the ability to drag a bot preview in the bot table to drag a mod of it.
    -   Hid the ID tag when a mod is selected.
    -   Hid all other buttons when a mod is selected in the bot table.

## V0.11.17

### Date: 12/20/2019

### Changes:

-   **Breaking Changes**
    -   Changed `@onDrop`, `@onDropEnter`, and `@onDropExit` to use the same parameters.
        -   `that` is an object with the following properties:
            -   `dragBot` - The bot that is being dragged.
            -   `to` - an object with the following properties:
                -   `context` - The context the bot is being dragged into.
                -   `x` - The X grid position the bot is being dragged to.
                -   `y` - The Y grid position the bot is being dragged to.
                -   `bot` - The bot that the `dragBot` is being dragged onto.
            -   `from` - an object with the following properties:
                -   `context` The context the bot is being dragged from.
                -   `x` - The X grid position the bot is being dragged from.
                -   `y` - The Y grid position the bot is being dragged from.
-   Improvements
    -   `create()` will now automatically set the `auxCreator` tag to `null` if it references a bot that is in a different space from the created bot.
    -   Also `create()` will not set the `auxCreator` tag to `null` if it references a non-existent bot.
    -   Added the `changeState(bot, stateName, groupName)` function to help with building state machines.
        -   Sets the `[groupName]` tag to `[stateName]` on `bot` and sends "on enter" and "on exit" whispers to the bot that was updated.
        -   `groupName` defaults to `"state"` if not specified.
        -   If the state has changed, then a `@[groupName][previousStateName]OnExit()` and `@[groupName][stateName]OnEnter()` whispers are sent to the updated bot.
            -   `that` is a object with the following properties:
                -   `from` - The previous state name.
                -   `to` - The next state name.
        -   Example: Running `changeState(bot, "Running")` will set the `state` tag to `"Running"` and will send a `@stateRunningOnEnter()` whisper to the bot.

## V0.11.16

### Date: 12/19/2019

### Changes:

-   **Breaking Changes**
    -   Renamed `onBotDrag` and `onBotDrop` to `onDrag` and `onDrop` respectively.
    -   Renamed `onMod` to `onModDrop`.
    -   Removed `onCombine`, `onCombineEnter`, and `onCombineExit`.
    -   Dropping a mod in an empty space will no longer create a new bot.
    -   Setting `auxPositioningMode` to `absolute` will no longer prevent mods.
    -   Changed `applyMod()` and `subtractMods()` to not send `onMod()` events.
    -   Renamed the `diffs` property on the `onModDrop` argument to `mod`.
-   Improvements
    -   Added `onModDropEnter` and `onModDropExit` listeners for when a mod is dragged onto or off of a bot.
        -   The bot that the mod will be applied to recieves the `onModDropEnter` and `onModDropExit` events.
    -   If a custom `onModDrop` listener is provided, then the mod will not be applied. It is up to the `onModDrop` listener to apply the mod via `applyMod(this, that.mod)`.
    -   Added `onDropEnter` and `onDropExit` listeners for when a bot is dragged onto or off of another bot.
        -   Both the bot that is being dragged and the bot that they are on top of will recieve the `onDropEnter` and `onDropExit` events.
        -   Note that `onDropEnter` and `onDropExit` events will fire even if one of the bots is not stackable.
        -   They have the following parameters:
            -   `draggedBot` - the bot that is being dragged.
            -   `otherBot` - the bot that the dragged bot is on top of.
            -   `context` - the context that this is happening in.
    -   Improved `onDrop` to be sent to both the dragged bot and the bot that it is dropped on top of.
        -   The event will fire on the other bot even if it has `auxPositioningMode` set to `absolute`.
    -   Added the `player.setClipboard()` function that is able to set the user's clipboard to the given text.
        -   ex. `player.setClipboard("abc")` will set the user's clipboard to "abc".
        -   On Chrome and Firefox, the text will be copied directly to the user's clipboard.
        -   On Safari and all iOS browsers, a popup will be triggered with a copy button allowing the user to copy the text to their clipboard.
    -   Tags that contain listeners will now display with a @ symbol in front of the tag name.
    -   Tags that contain formulas will now display with a = sign after the tag name.
    -   Removed the @ symbol from the first line in the code editor when editing a script.
    -   Added the ability to use an @ symbol while creating a new tag to prefill the editor with an @.
    -   Added the ability to use @ symbols in tags in `getTag()`, `setTag()`, `getBot()`, `getBots()`, `byTag()`, `shout()`, and `whisper()`.
    -   Added tag filters for listener tags and formula tags to the bot table.
    -   Added the ability to detect the `tags` variable in scripts as a reference to tags.
        -   This is useful for knowing when to update a formula.
        -   Also works with the `raw` variable.
        -   Limitations:
            -   Does not detect references via the `bot` or `this` variables. (e.g. `bot.tags.abc`)
            -   Does not detect references via other bots. (e.g. `otherBot.tags.abc`)
            -   Does not detect references if a function is called on the tag. (e.g. `tags.name.toString()`)
        -   If you need to work around the limitations, use the `getTag()` function.

## V0.11.15

### Date: 12/17/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue where `player.replaceDragBot()` actions were not getting processed because some data was improperly formatted.
    -   Resolved issue with inventory not remaining in place on resizing.

## V0.11.14

### Date: 12/16/2019

### Changes:

-   **Breaking Changes**

    -   Removed `auxStackable` and replaced it with `auxPositioningMode`.
        -   `auxPositioningMode` has two possible values:
            -   `stack` - Indicates that the bot will stack on top of other bots (default)
            -   `absolute` - Indicates that the bot will ignore other bots when positioning.
    -   Removed the `createTemp()` function.
        -   It has been replaced with the `{ space: "value" }` mod.
        -   e.g. Instead of `createTemp()` you should use `create({ space: "tempLocal" })`.
    -   Removed the `cookie` bot. It has been replaced with the `local` space.
    -   Removed the following functions:
        -   `addToContextMod()`
        -   `removeFromContextMod()`
        -   `addToMenuMod()`
        -   `removeFromMenuMod()`
        -   `setPositionMod()`
        -   `from()`
            -   You can use a mod declaration with the new `getID()` function to achieve the same functionality:
            -   `{ auxCreator: getID(bot) }`
    -   Renamed the `createdBy()` filter function to `byCreator()`.

-   Improvements
    -   Added the `space` tag which indicates where a bot will be stored.
        -   The following spaces are currently available:
            -   `shared` - This space is shared among multiple users and is persistent. This is the default space for bots if not specified.
            -   `tempLocal` - This space is not shared and is cleared every time the browser refreshes.
            -   `local` - This space is kept on your device and is persistent.
        -   When creating a bot, you can set the space that it will be stored in using a `{ space: "value" }` mod.
            -   e.g. `create({ space: "local" })` will create a new bot in the `local` space.
            -   Creating a bot from another bot will inherit spaces. So cloning a `tempLocal` bot will produce another `tempLocal` bot. You can of course override this using a mod.
        -   You can search for bots in a specific space using the `bySpace()` filter function.
            -   e.g. `getBots(bySpace("local"))` will get all the bots in the `local` space.
            -   It is simply an alternative way to do `getBots(byTag("space", value))`.
    -   Added the following functions:
        -   `getID(bot)` gets the ID of a bot. If given a string, then that will be returned instead.
        -   `getJSON(data)` gets a JSON string for the given data.
-   Bug Fixes
    -   Resolved issue of orientation inverting then attepting to resize the inventory once the viewport has beeen panned.

## V0.11.13

### Date: 12/13/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue where having duplicate bot atoms could cause the bot values to be locked because it would chose the wrong bot to update.

## V0.11.12

### Date: 12/12/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue where script bots were not being converted back into normal bots correctly.

## V0.11.11

### Date: 12/12/2019

### Changes:

-   **Breaking Changes**

    -   Changed `create()` and `createTemp()` to automatically set `auxCreator` to the current `this` bot.
        -   `create()` no longer takes a bot/bot ID as the first parameter. Instead, you need to use the `from()` function to set the creator ID.
        -   e.g. `create(from(bot))`.
    -   Renamed all listen tags to not use the `()` at the end.
        -   Every tag is now the same. This means that `()` to the end of a tag does nothing special.
        -   i.e. There is no difference between a "normal" tag and a "listen" tag.
        -   Instead, tags can listen by prefixing their script with a `@` symbol.
        -   e.g. `player.toast("Hi!")` becomes `@player.toast("Hi!")`.
    -   Renamed `mod()` to `applyMod()`.
    -   Renamed `mod.addToMenu()` to `addToMenuMod()`.
    -   Renamed `mod.removeFromMenu()` to `removeFromMenuMod()`.
    -   Renamed `mod.addToContext()` to `addToContextMod()`.
    -   Renamed `mod.removeFromContext()` to `removeFromContextMod()`.
    -   Renamed `mod.setPosition()` to `setPositionMod()`.
    -   Renamed `mod.subtract()` to `subtractMods()`.
    -   Renamed `mod.import()` to `getMod()`.
    -   Removed `mod.export()`.

-   Improvements
    -   Added a `creator` variable to scripts and formulas which gets the bot that created the `this` bot.
        -   `creator` is null if the current bot has no creator.
    -   Added a `raw` variable to scripts and formulas which gets direct access to the `this` bot's tag values.
        -   This is similar to the `tags` variable but does not do any pre-processing on the tag value. This means you will get formula scripts back instead of the calculated formula values.
    -   Improved the `tags` variable to handle setting tag values on it.
        -   This lets you write scripts like `tags.name = "joe"` or `bot.tags.myContext = true`.
        -   Also works with the `raw` variable.
    -   Improved bots returned from `getBots()` and `getBot()` to support setting tag values on their `tags` property.
        -   This lets you write things like `myBot.tags.name = "bob"`.
        -   Should also work with bots in the `that` variable.
    -   Added a `data` variable which equals `that`.
    -   Added the `player.hideHtml()` function which hides the HTML modal.
    -   Added in inventory tags to limit panning movements on the inventory context: `auxContextInventoryPannableMinX`, `auxContextInventoryPannableMaxX`, `auxContextInventoryPannableMinY`, `auxContextInventoryPannableMaxY`.
    -   Reformatted new selection id logic by removing the `._` character from its return.

## V0.11.10

### Date: 12/9/2019

### Changes:

-   Bug Fixes
    -   Resolved issue of hidden tags showing up when no filter has been selected on the table.

## V0.11.9

### Date: 12/6/2019

### Changes:

-   **Breaking Changes**
    -   `removeTags()` now checks if a tag starts with the given search value.
        -   Previously it would check if the search value matched the first part of a tag up do the dot (`.`).
        -   Now, it will remove all tags that start with the given search value.
        -   e.g. `removeTags(bot, "hello")` will remove `hello`, `helloAbc`, and `helloX`.
    -   The bot table tag blacklist has been updated to support camel cased tags.
    -   Renamed several functions:
        -   Renamed `onAnyAction()` to `onChannelAction()`.
        -   Renamed `player.currentChannel()` to `player.getCurrentChannel()`.
        -   Renamed `player.currentContext()` to `player.getCurrentContext()`.
        -   Renamed `mod.apply()` to `mod()`.
            -   All the other `mod.` functions remain the same.
            -   ex. `mod.export()` still works.
    -   Renamed all of the built-in tags to use `camelCase` instead of `dot.case`.
        -   Renamed all the scene tags to channel tags.
            -   `aux.scene.color` is now `auxChannelColor`
            -   `aux.scene.user.player.color` is now `auxChannelUserPlayerColor`
            -   `aux.scene.user.builder.color` is now `auxChannelUserBuilderColor`
        -   Renamed `aux.inventory.height` to `auxInventoryHeight`.
        -   Renamed `aux.channel` to `auxChannel`.
        -   Renamed `aux.connectedSessions` to `auxConnectedSessions`.
        -   Renamed `aux.color` to `auxColor`.
        -   Renamed `aux.creator` to `auxCreator`.
        -   Renamed `aux.draggable` to `auxDraggable`.
        -   Renamed `aux.draggable.mode` to `auxDraggableMode`.
        -   Renamed `aux.stackable` to `auxStackable`.
        -   Renamed `aux.destroyable` to `auxDestroyable`.
        -   Renamed `aux.editable` to `auxEditable`.
        -   Renamed `aux.stroke.color` to `auxStrokeColor`.
        -   Renamed `aux.stroke.width` to `auxStrokeWidth`.
        -   Renamed `aux.line.to` to `auxLineTo`.
        -   Renamed `aux.line.width` to `auxLineWidth`.
        -   Renamed `aux.line.style` to `auxLineStyle`.
        -   Renamed `aux.line.color` to `auxLineColor`.
        -   Renamed `aux.label` to `auxLabel`.
        -   Renamed `aux.label.color` to `auxLabelColor`.
        -   Renamed `aux.label.size` to `auxLabelSize`.
        -   Renamed `aux.label.size.mode` to `auxLabelSizeMode`.
        -   Renamed `aux.label.anchor` to `auxLabelAnchor`.
        -   Renamed `aux.listening` to `auxListening`.
        -   Renamed `aux.shape` to `auxShape`.
        -   Renamed `aux.scale` to `auxScale`.
        -   Renamed `aux.scale.x` to `auxScaleX`.
        -   Renamed `aux.scale.y` to `auxScaleY`.
        -   Renamed `aux.scale.z` to `auxScaleZ`.
        -   Renamed `aux.image` to `auxImage`.
        -   Renamed `aux.iframe` to `auxIframe`.
        -   Renamed `aux.iframe.x` to `auxIframeX`.
        -   Renamed `aux.iframe.y` to `auxIframeY`.
        -   Renamed `aux.iframe.z` to `auxIframeZ`.
        -   Renamed `aux.iframe.size.x` to `auxIframeSizeX`.
        -   Renamed `aux.iframe.size.y` to `auxIframeSizeY`.
        -   Renamed `aux.iframe.rotation.x` to `auxIframeRotationX`.
        -   Renamed `aux.iframe.rotation.y` to `auxIframeRotationY`.
        -   Renamed `aux.iframe.rotation.z` to `auxIframeRotationZ`.
        -   Renamed `aux.iframe.element.width` to `auxIframeElementWidth`.
        -   Renamed `aux.iframe.scale` to `auxIframeScale`.
        -   Renamed `aux.progressBar` to `auxProgressBar`.
        -   Renamed `aux.progressBar.color` to `auxProgressBarColor`.
        -   Renamed `aux.progressBar.backgroundColor` to `auxProgressBarBackgroundColor`.
        -   Renamed `aux.progressBar.anchor` to `auxProgressBarAnchor`.
        -   Renamed `aux._selection` to `_auxSelection`.
        -   Renamed `aux._user` to `_auxUser`.
        -   Renamed `aux.user.active` to `auxUserActive`.
        -   Renamed `aux.version` to `auxVersion`.
        -   Renamed `aux._userChannel` to `_auxUserChannel`.
        -   Renamed `aux._userContext` to `_auxUserContext`.
        -   Renamed `aux._userInventoryContext` to `_auxUserInventoryContext`.
        -   Renamed `aux._userMenuContext` to `_auxUserMenuContext`.
        -   Renamed `aux._userSimulationsContext` to `_auxUserChannelsContext`.
        -   Renamed `aux._editingBot` to `_auxEditingBot`.
        -   Renamed `aux._selectionMode` to `_auxSelectionMode`.
        -   Renamed `aux.runningTasks` to `auxRunningTasks`.
        -   Renamed `aux.finishedTasks` to `auxFinishedTasks`.
        -   Renamed `aux.task.output` to `auxTaskOutput`.
        -   Renamed `aux.task.error` to `auxTaskError`.
        -   Renamed `aux.task.time` to `auxTaskTime`.
        -   Renamed `aux.task.shell` to `auxTaskShell`.
        -   Renamed `aux.task.backup` to `auxTaskBackup`.
        -   Renamed `aux.task.backup.type` to `auxTaskBackupType`.
        -   Renamed `aux.task.backup.url` to `auxTaskBackupUrl`.
        -   Renamed `aux.context` to `auxContext`.
        -   Renamed `aux.context.color` to `auxContextColor`.
        -   Renamed `aux.context.locked` to `auxContextLocked`.
        -   Renamed `aux.context.grid.scale` to `auxContextGridScale`.
        -   Renamed `aux.context.visualize` to `auxContextVisualize`.
        -   Renamed `aux.context.x` to `auxContextX`.
        -   Renamed `aux.context.y` to `auxContextY`.
        -   Renamed `aux.context.z` to `auxContextZ`.
        -   Renamed `aux.context.rotation.x` to `auxContextRotationX`.
        -   Renamed `aux.context.rotation.y` to `auxContextRotationY`.
        -   Renamed `aux.context.rotation.z` to `auxContextRotationZ`.
        -   Renamed `aux.context.surface.scale` to `auxContextSurfaceScale`.
        -   Renamed `aux.context.surface.size` to `auxContextSurfaceSize`.
        -   Renamed `aux.context.surface.minimized` to `auxContextSurfaceMinimized`.
        -   Renamed `aux.context.surface.defaultHeight` to `auxContextSurfaceDefaultHeight`.
        -   Renamed `aux.context.surface.movable` to `auxContextSurfaceMovable`.
        -   Renamed `aux.context.player.rotation.x` to `auxContextPlayerRotationX`.
        -   Renamed `aux.context.player.rotation.y` to `auxContextPlayerRotationY`.
        -   Renamed `aux.context.player.zoom` to `auxContextPlayerZoom`.
        -   Renamed `aux.context.devices.visible` to `auxContextDevicesVisible`.
        -   Renamed `aux.context.inventory.color` to `auxContextInventoryColor`.
        -   Renamed `aux.context.inventory.height` to `auxContextInventoryHeight`.
        -   Renamed `aux.context.inventory.pannable` to `auxContextInventoryPannable`.
        -   Renamed `aux.context.inventory.resizable` to `auxContextInventoryResizable`.
        -   Renamed `aux.context.inventory.rotatable` to `auxContextInventoryRotatable`.
        -   Renamed `aux.context.inventory.zoomable` to `auxContextInventoryZoomable`.
        -   Renamed `aux.context.inventory.visible` to `auxContextInventoryVisible`.
        -   Renamed `aux.context.pannable` to `auxContextPannable`.
        -   Renamed `aux.context.pannable.min.x` to `auxContextPannableMinX`.
        -   Renamed `aux.context.pannable.max.x` to `auxContextPannableMaxX`.
        -   Renamed `aux.context.pannable.min.y` to `auxContextPannableMinY`.
        -   Renamed `aux.context.pannable.max.y` to `auxContextPannableMaxY`.
        -   Renamed `aux.context.zoomable` to `auxContextZoomable`.
        -   Renamed `aux.context.zoomable.min` to `auxContextZoomableMin`.
        -   Renamed `aux.context.zoomable.max` to `auxContextZoomableMax`.
        -   Renamed `aux.context.rotatable` to `auxContextRotatable`.
        -   Renamed `stripe.publishableKey` to `stripePublishableKey`.
        -   Renamed `stripe.secretKey` to `stripeSecretKey`.
        -   Renamed `stripe.charges` to `stripeCharges`.
        -   Renamed `stripe.successfulCharges` to `stripeSuccessfulCharges`.
        -   Renamed `stripe.failedCharges` to `stripeFailedCharges`.
        -   Renamed `stripe.charge` to `stripeCharge`.
        -   Renamed `stripe.charge.receipt.url` to `stripeChargeReceiptUrl`.
        -   Renamed `stripe.charge.receipt.number` to `stripeChargeReceiptNumber`.
        -   Renamed `stripe.charge.description` to `stripeChargeDescription`.
        -   Renamed `stripe.outcome.networkStatus` to `stripeOutcomeNetworkStatus`.
        -   Renamed `stripe.outcome.reason` to `stripeOutcomeReason`.
        -   Renamed `stripe.outcome.riskLevel` to `stripeOutcomeRiskLevel`.
        -   Renamed `stripe.outcome.riskScore` to `stripeOutcomeRiskScore`.
        -   Renamed `stripe.outcome.rule` to `stripeOutcomeRule`.
        -   Renamed `stripe.outcome.sellerMessage` to `stripeOutcomeSellerMessage`.
        -   Renamed `stripe.outcome.type` to `stripeOutcomeType`.
        -   Renamed `stripe.errors` to `stripeErrors`.
        -   Renamed `stripe.error` to `stripeError`.
        -   Renamed `stripe.error.type` to `stripeErrorType`.
-   Improvements
    -   Added the `renameTagsFromDotCaseToCamelCase()` function to help with updating bots from the old tag style to the new tag style.
        -   Use this function on bots that were using the old tag naming style but you want to use the new style.
        -   Note that this only renames the tags already existing on the bot. It does not fix any code that might be stored in the bot.
        -   Usage: `renameTagsFromDotCaseToCamelCase(bot)`
    -   Added the `bot` variable to all functions and formulas.
        -   Replacement for `this`.
    -   Added the `getMod()` function to be able to get all the tags on a bot.
        -   Returns a mod containing all the tag values on the bot.
        -   The returned mod is always up to date with the bot's current values.
        -   Calling `mod.export()` on the returned mod will save the tag code to JSON.
            -   For example, if you have a formula `=123`, then `mod.export(getMod(bot))` will return JSON containing `tag: "=123"` instead of `tag: 123`.
    -   Added the `tags` variable to all functions and formulas.
        -   This is a quick shortcut for `let tags = getMod(bot)` at the beginning of a script/formula.
        -   The `tags` variable has some caveats when used in formulas. Namely that the formulas won't be automatically updated when another tag referenced from the formula is updated. (Use `getTag()` for full support)
        -   Supports autocomplete for all tags.

## V0.11.8

### Date: 12/3/2019

### Changes:

-   Improvements
    -   Added a new system for managing causal trees.
        -   This new system has improvements for performance and reliability.
        -   It also adds support for revision history. (The controls will be coming in a future update)
        -   Every new channel will use the new system while old channels will continue to use the old one.
        -   Everything should function exactly the same as before.
    -   Changed the .aux file format.
        -   The new format is based on the bots state and is easily human readable/writable.
        -   This is different from the old format where a list of atoms was stored.
        -   Downloading a channel will give you a .aux file with the new format.
        -   Uploading a channel supports both the old format and the new format.

## V0.11.7

### Date: 11/27/2019

### Changes:

-   Improvements
    -   Changed the functionality of the table view's filterying system to be inverted.
    -   Attempting to drag a bot onto a bot with `aux.stackable` set to false will now cause the dragged bot to pass through the other bot as if it was not there.
-   Bug Fixes
    -   Resolved issue of player inventory resizing showing a reset on each change.
    -   Tag values that are objects are displayed as JSON.Stringified text. ie `{ field: "myValue" }`
        -   Known Issue: Modifying these displayed strings will convert the tag value to a string
    -   When Moving the camera via `player.MoveTo()`, the pan distance is now set correctly so pan limits are absolute.

## V0.11.6

### Date: 11/6/2019

### Changes:

-   Improvements
    -   Added the `server.setupChannel(channel, botOrMod)` function.
        -   This sends a `setup_channel` action to the server which, if executed using `action.perform()`, will create a channel if it doesn't already exist and place a clone of the given bot or mod in it.
        -   Takes 2 parameters:
            -   `channel` - The channel that should be created.
            -   `botOrMod` - (Optional) The bot or mod that should be cloned and placed inside the new channel. `onCreate()` is triggered after the bot or mod is created so you can use that to script custom setup logic.
        -   As mentioned above, you have to receive the `device` action in `onAnyAction()` and do an `action.perform(that.action.event)` to allow channels to be setup via this function.

## V0.11.5

### Date: 10/31/2019

### Changes:

-   Improvements
    -   Added the `player.replaceDragBot(botOrMod)` function.
        -   When used inside of `onBotDrag()` or `onAnyBotDrag()`, it will set the bot/mod that the user is dragging.
        -   Use this to implement clone or cloneAsMod style functionality.
    -   Added the ability to create temporary bots using the `createTemp()` function.
        -   This function behaves exactly the same as `create()` but the created bot is temporary, which means it won't be shared and will be deleted upon refresh.
-   Changes
    -   Renamed `aux.movable` to `aux.draggable`.
        -   `aux.draggable` now only woks with `true` and `false` values.
        -   The `pickup` and `drag` options have been moved to a new tag `aux.draggable.mode`.
        -   The `clone` and `cloneMod` options have been removed.
            -   You will need to use the new `player.replaceDragBot()` API to replicate `clone` and `cloneMod` behavior.
    -   Removed the `aux.mergeable` tag.
        -   It has been replaced with the `aux.stackable` tag.
    -   Removed the `aux.mod` and `aux.mod.mergeTags` tags.
    -   Renamed the `local` bot to the `cookie` bot.
        -   This is supposed to help make it clear that the bot data is stored in the browser and will be cleared when the browser's data is cleared.
    -   Renamed the `aux.users` context to `aux-users`.
    -   Added the `aux.inventory.height` tag which controls the default height of the inventory on all contexts when set of the config bot.
        -   The `aux.context.inventory.height` tag has been updated to only work on the context bot.
    -   Removed names from the other player frustums.
    -   Removed `aux.whitelist`, `aux.blacklist`, and `aux.designers`.
-   Bug Fixes
    -   Fixed an issue that would cause duplicate users to be created all the time.
    -   Fixed an issue that prevented other users from being rendered.
    -   Fixed an issue that caused all users to use channel designer colors.

## V0.11.4

### Date: 10/29/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue in production builds that pre-processed the QR Code scanner code with babel. As a result, async code in the QR Code scanner failed because the babel polyfill is not being used.

## V0.11.3

### Date: 10/28/2019

### Changes:

-   Improvements
    -   Improved the vendor JavaScript bundle size by removing unused code.
        -   Refactored `three-vrcontroller-module` to use the `three` package instead of `three-full` so we don't duplicate Three.js.
        -   Removed unused shims (PEP.js, `webrtc-adapter`).
        -   Refactored `lodash` imports to directly import the modules that are used.
            -   This helps with dead code eliminiation.
    -   Added the ability to save and load files.
        -   New functions:
            -   `server.saveFile(filename, data, options)`
                -   `filename` is a string and should start with `/drives/`.
                -   `data` is a string of the data to store.
                -   `options` is an object with the following properties:
                    -   `callbackShout` A shout that should happen on the server when the file is done saving.
                    -   `overwriteExistingFile` A boolean that indicates if existing files should be overwritten. (defaults to false)
            -   `server.loadFile(filename, options)`
                -   `filename` is a string and should start with `/drives/`.
                -   `options` is an object with the following properties:
                    -   `callbackShout` A shout that should happen on the server when the file is done loading.
        -   Note that the save file and load file tasks must be enabled via the `onAnyAction()` listener.
            -   You can enable it via using this code:
            ```javascript
            if (that.action.type === 'device') {
                if (
                    ['save_file', 'load_file'].indexOf(
                        that.action.event.type
                    ) >= 0
                ) {
                    action.perform(that.action.event);
                }
            }
            ```
        -   All files from USB drives are stored under the `/drives` directory and the USB drives themselves are numbered starting with 0.
            -   To load a file from USB drive #1, use `server.loadFile("/drives/0/myFile")`.
            -   To save a file to USB drive #2, use `server.saveFile("/drives/1/myFile", data)`.
    -   Removed several options from the side menu:
        -   Removed the channel name from the top of the menu.
        -   Removed the login status from the top of the menu.
        -   Removed the login/logout options from the menu.
            -   The "Logout" option will still be available if you are logged in as a non-guest.
            -   Once you are logged out, then the option will dissapear.
        -   Removed the "Add Channel" option from the menu in AUXPlayer.
-   Bug Fixes
    -   Fixed an issue that prevented the `removeTags()` function from working when given an array of bots.

## V0.11.2

### Date: 10/23/2019

### Changes:

-   Improvements
    -   Improved initial loading time by up to 70%.
    -   Added the ability to choose which camera is used for QR and Barcode scanning.
        -   The following functions have been improved:
            -   `player.openQRCodeScanner(camera)`
            -   `player.openBarcodeScanner(camera)`
        -   The `camera` parameter is optional and takes 2 values: `"front"` or `"rear"`.
    -   Add the `LOCAL_IP_ADDRESS` environment variable which controls the private IP Address that the directory client reports.
    -   Added the ability to serve files from an external folder.
        -   Makes it easy for us to map USB drives into the folder and have them be automatically served to AUX users.
-   Changes
    -   User bots no longer register their own context. Instead, a new bot has been created to host the `aux.users` context.
        -   Improves performance of AUXes with many user bots with the same username.
        -   Existing user bots are not affected. They will be deleted automatically if given enough time. Alternatively, you can delete them using `destroy(getBots("#aux._user"))`.
-   Bug Fixes
    -   Fixed an issue where bots would have the incorrect height because of conflicts in a caching mechanism.
    -   Audio will now trigger on ios devices and on the safari browser.

## V0.11.1

### Date: 10/21/2019

### Changes:

-   Improvements
    -   Added in `player.playSound()` function, will play a sound, given by the url path, once.
-   Bug Fixes
    -   Fixed issue where default panning tag locked the vertical movement in player.

## V0.11.0

### Date: 10/18/2019

### Changes:

-   Improvements
    -   Made the menu item count badge a lighter gray.
    -   Removed the item count badge from the menu.
    -   Removed the dropdown aspect of the menu.
-   Changes

    -   Made the menu item count badge a lighter gray.
    -   Removed the admin channel and admin-channel specific functionality.
        -   This means that there are no more user account bots or channel bots.
            -   You can login as anyone from any device without requiring additional authentication.
            -   You can access any channel. No need to create a channel first. (because there are no channel bots anymore)
            -   The connection counts are now stored in the config bot of the channel.
            -   Connection limits no longer work since they were set on the channel bot in the admin channel.
            -   Username whitelists and blacklists still work, but they rely on client-side script execution instead of server-side execution.
        -   It also means there is no admin role. For now, everyone has admin permissions.
        -   `action.perform()` now needs to be used to run actions on the server.
            -   You can send an action to the server using the `remote()` function.
            -   The server will receive the action in its `onAnyAction()` as `that.action.type === "device"`
            -   `onAnyAction()` has to detect remove events and execute the inner action via `action.perform(that.action.event)`.
        -   The following functions have been removed:
            -   `server.grantRole()`
            -   `server.revokeRole()`
        -   The following functions are not executed by default and require a custom `onAnyAction()` to handle them.
            -   `server.backupAsDownload()`
            -   `server.backupToGithub()`
            -   `server.shell()`
        -   `server.backupAsDownload()` has been updated to accept a "session selector" which determines which session the ZIP file should be sent to.
            -   ex. `server.backupAsDownload({ username: getTag(player.getBot(), "#aux._user") })`
        -   Removed the `aux._lastEditedBy` tag.
            -   This tag was automatically set to the ID of the user whenever a bot was edited.
            -   Currently, it is extra cruft that is not needed and could be easily implemented via `onAnyAction()`.
    -   Centered the menu above the player inventory.
    -   Increased menu text size.
    -   Added in new camera range tags: `aux.context.zoomable.min`, `aux.context.zoomable.max` `aux.context.pannable.min.x`, `aux.context.pannable.max.x`, `aux.context.pannable.min.y`, `aux.context.pannable.max.y`.

-   Bug Fixes
    -   Removed hidden inventory dragging hitboxes when inventory is set to non-visible.

## V0.10.10

### Date: 10/11/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue where sometimes DependencyManager would be given a bot that was undefined which would crash the simulation.

## V0.10.9

### Date: 10/11/2019

### Changes:

-   Bug Fixes
    -   Fixed the ability to make other users admins.

## V0.10.8

### Date: 10/09/2019

### Changes:

-   Improvements
    -   Added a Content-Security-Policy to HTML Modals which prevents them from including scripts of any kind.
        -   This prevents malicious users from executing cross-channel scripting attacks.
        -   Scripts are still allowed in iframes loaded from external domains. (like youtube)
-   Bug Fixes
    -   Disabled the site-wide Content-Security-Policy.
        -   Many devices enforce Content-Security-Policy differently and so it is difficult to find an option which is secure and compatible.

## V0.10.7

### Date: 10/09/2019

### Changes:

-   Bug Fixes
    -   Added a workaround for an issue with Amazon Kindle tablets that caused the Content-Security-Policy to not work correctly.
        -   Downside is that security is less effective since now HTML modals can load whatever scripts they want. (XSS threat)
        -   As a result, this workaround is only applied to Kindle devices.

## V0.10.6

### Date: 10/08/2019

### Changes:

-   Bug Fixes
    -   Fixed labels.

## V0.10.5

### Date: 10/08/2019

### Changes:

-   Improvements
    -   Added the `player.showHtml(html)` function that shows a modal with the given HTML.
        -   Optimized for embedding YouTube videos but works with any arbitrary HTML.
        -   Embedding JavaScript is not supported.
-   Bug Fixes
    -   Fixed an issue that prevented tabs with the same URL from seeing each other's changes to the local bot.

## V0.10.4

### Date: 10/08/2019

### Changes:

-   Improvements
    -   Added `onAnyAction()` action tag to intercept and change actions before they are executed.
        -   `onAnyAction()` runs for every action, including when a bot is created, changed, or deleted.
        -   Every action is an object with a `type` property.
            -   The `type` property is a string that indicates what the action does.
            -   Here is a partial list of types:
                -   `add_bot`: A bot should be added (i.e. created).
                -   `remove_bot`: A bot should be removed (i.e. deleted).
                -   `update_bot`: A bot should be updated.
                -   `apply_state`: The given bot state should be applied. (i.e. a set of bots should be created/updated)
                -   `shout`: A shout should be executed.
                -   `show_toast`: A toast message should be shown on the device.
                -   `show_barcode`: A barcode should be shown.
                -   `tween_to`: The camera should be tweened to show a bot.
        -   `that` is an object with the following properties:
            -   `action`: The action that is going to be executed.
        -   Forking a channel clears the `onAnyAction()` on the config bot.
            -   This is so that you can recover from broken states and also gives the person who forked the AUX full control over the fork.
    -   Added two new script functions:
        -   `action.reject(action)`: Prevents the given action from being performed. Returns the rejection action.
        -   `action.perform(action)`: Adds the given action to the performance queue so it will be performed. This can be used to re-enable an action after it has been rejected (you can also reject the rejection action). Returns the action that will be performed.
    -   Added a `local` bot which is stored in the browser's local storage.
        -   The `local` bot is a bot that is unique to the device and channel.
        -   You can access the bot by querying for it: `getBot("#id", "local")`.
    -   Renamed `onShout()` to `onAnyListen()`.
    -   Added `onListen()` which is an alternative to `onAnyListen()` that is only called on the targeted bots.
    -   Added ability to set duration of toast, `plater.toast("message", durationNum)`.
    -   Made the background for the menu label gray.

## V0.10.3

### Date: 10/04/2019

### Changes:

-   Improvements
    -   Added tags to control panning, zooming, and rotating the main camera.
        -   `aux.context.pannable`: Controls whether the main camera is able to be panned.
        -   `aux.context.zoomable`: Controls whether the main camera is able to be zoomed.
        -   `aux.context.rotatable`: Controls whether the main camera is able to be rotated.
    -   Added `player.moveTo()` to instantly tween the camera to a bot.
        -   In the future, custom tween durations will be supported.
    -   Changed the low camera angle limit to 32 degrees from 10 degrees.
    -   `onCombineExit` action will now fire alongside the `onCombine` action.
    -   Newly created contexts will no longer be autoselected.
    -   Toast messages will now only remain on screen for 2 seconds.
    -   Added the ability to send webhooks from the server.
        -   You can also tell the server to send a webhook via `remote(webhook())`.
        -   This is useful for getting around CORS issues.
-   Bug Fixes
    -   Fixed `player.tweenTo()` to not change the zoom level when it is not specified.
    -   Tweens will now work better with the `onPlayerEnterContext` action.

## V0.10.2

### Date: 09/27/2019

### Changes:

-   Bug Fixes
    -   Resolved issues with context changing affecting base simulation identifier.
    -   Invoke a camera reset upon changing contexts via `player.goToContext()`.

## V0.10.1

### Date: 09/26/2019

### Changes:

-   Improvements
    -   Browser tab will now update to correct context when switched to with `player.goToContext()`.
-   Bug Fixes
    -   Resolved error in inventory setup causing runtime issues.

## V0.10.0

### Date: 09/25/2019

### Changes:

-   Improvements
    -   Added the ability to send and receive webhooks.
        -   Send webhooks using the following functions:
            -   `webhook(options)` - options is an object that takes the following properties:
                -   `method` - The HTTP Method that should be used for the request.
                -   `url` - The URL that the request should be made to.
                -   `responseShout` - (Optional) The shout that should happen when a response is received from the server.
                -   `headers` - (Optional) The HTTP headers that should be sent with the request.
                -   `data` - (Optional) The data that should be sent with the request.
            -   `webhook.post(url, data, options)` - Sends a HTTP Post request.
                -   `url` - The URL that the request should be made to.
                -   `data` - (Optional) The data that should be sent with the request.
                -   `options` - (Optional) An object that takes the following properties:
                    -   `responseShout` - (Optional) The shout that should happen when a response is received from the server.
                    -   `headers` - (Optional) The headers that should be sent with the request.
        -   Receive webhooks by registering a handler for the `onWebhook()` action and send requests to `https://auxplayer.com/{context}/{channel}/whatever-you-want`.
            -   `onWebhook()` is shouted to the channel that the request was made to and `that` is an object with the following properties:
                -   `method` - The HTTP Method that the request was made with.
                -   `url` - The URL that the request was made to.
                -   `data` - The JSON data that the request included.
                -   `headers` - The HTTP headers that were included with the request.
    -   Added the ability to spy on shouts and whispers via the `onShout()` event.
        -   `onShout()` is executed on every bot whenever a shout or whisper happens.
            -   It is useful for tracking what shouts are being made and modifying responses.
            -   Also useful for providing default behaviors.
            -   `that` is an object with the following properties:
                -   `name` is the name of the action being shouted.
                -   `that` is the argument which was provided for the shout.
                -   `targets` is an array of bots that the shout was sent to.
                -   `listeners` is an array of bots that ran a script for the shout.
                -   `responses` is an array of responses that were returned from the listeners.
    -   Added events to notify scripts when channels become available.
        -   The following events have been added:
            -   `onChannelSubscribed()` - happens the first time a channel is loaded. Sent to every channel that is currently loaded.
            -   `onChannelUnsubscribed()` - happens when a channel is unloaded. Sent to every channel that remains after the channel is unloaded.
            -   `onChannelStreaming()` - happens when a channel is connected and fully synced. Sent to every channel that is currently loaded.
            -   `onChannelStreamLost()` - happens when a channel is disconnected and may not be fully synced. Sent to every channel that is currently loaded.
            -   For all events, `that` is an object with the following properties:
                -   `channel` - The channel that the event is for.
        -   The following events have been removed:
            -   `onConnected()`
            -   `onDisconnected()`
    -   Added in tags to change the state of the inventory's camera controls:
        -   `aux.context.inventory.pannable` enables and disables the inventory's ability to pan, off by default.
        -   `aux.context.inventory.resizable` enables and disables the inventory's drag to resize functionality, on by default.
        -   `aux.context.inventory.rotatable` enables and disables the inventory's ability to rotate, on by default.
        -   `aux.context.inventory.zoomable` enables and disables the inventory's ability to zoom, on by default.
-   Bug Fixes
    -   Resolved issue with the near cliiping plane for the sheet's minifile image.
    -   Resolved issues with the create empty bot button not functioning sometimes on mobile.

## V0.9.40

### Date: 09/20/2019

### Changes:

-   Improvements
    -   Reworked the login functionality to use popups instead of dedicated pages.
        -   The login page has been split into two popups:
            -   The login popup (account selector).
            -   The authorization popup (QR Scanner).
        -   The login popup has the following functions:
            -   It can be opened by the "Login/Logout" button in the menu.
            -   It will display a list of accounts that can be used to login.
            -   If no accounts are available, then a username box will be shown.
            -   If accounts are available, a new account can be added by clicking the "+" button at the bottom of the list.
            -   At any time, the user can close the popup to keep their current login.
            -   They can also select the "Continue as Guest" option to login as a guest.
        -   The authorization popup has the following functions:
            -   It is opened automatically when the user needs to scan an account code.
            -   It contains the QR Code scanner to scan the account code.
            -   It also contains an input box to manually enter the code.
            -   Closing the popup automatically logs the user in as a guest.
    -   Made the account QR Code blue.
    -   Added the ability to click the account QR Code to copy it to the clipboard.
-   Bug Fixes
    -   Fixed a couple communication issues between the server and client during login.
        -   One such issue could potentially leave the client in state where future changes would not be synced to the server.

## V0.9.39

### Date: 09/19/2019

### Changes:

-   Improvements
    -   Added support for accepting payments via Stripe.
        -   To get started with Stripe, first register for an account on [their website](https://dashboard.stripe.com/register).
        -   Second, copy your publishable key from the stripe dashboard and add it to the channel's config file in the `stripe.publishableKey` tag.
        -   Third, make a new channel. This will be the "processing" channel which will contain all the information actually needed to charge users for payments. And contain the code to actually complete a charge.
            -   In this channel, add your Stripe secret key to the config file in the `stripe.secretKey` tag.
        -   At this point, you are all setup to accept payments. Use the following functions:
            -   `player.checkout(options)`: Starts the checkout process for the user. Accepts an object with the following properties:
                -   `productId`: The ID of the product that is being purchased. This is a value that you make up to distinguish different products from each other so you know what to charge.
                -   `title`: The title message that should appear in the checkout box.
                -   `description`: The description message that should appear in the checkout box.
                -   `processingChannel`: The channel that payment processing should happen on. This is the channel you made from step 3.
                -   `requestBillingAddress`: Whether to request billing address information with the purchase.
                -   `paymentRequest`: Optional values for the "payment request" that gives users the option to use Apple Pay or their saved credit card information to checkout. It's an object that takes the following properties:
                    -   `country`: The two-letter country code of your Stripe account.
                    -   `currency`: The three letter currency code. For example, "usd" is for United States Dollars.
                    -   `total`: The label and amount for the total. An object that has the following properties:
                        -   `label`: The label that should be shown for the total.
                        -   `amount`: The amount that should be charged in the currency's smallest unit. (cents, etc.)
            -   `server.finishCheckout(options)`: Finishes the checkout process by actually charging the user for the product. Takes an object with the following properties:
                -   `token`: The token that was produced from the `onCheckout()` call in the processing channel.
                -   `amount`: The amount that should be charged in the currency's smallest unit.
                -   `currency`: The three character currency code.
                -   `description`: The description that should be included in the receipt.
                -   `extra`: Extra data that should be sent to the `onPaymentSuccessful()` or `onPaymentFailed()` actions.
        -   Additionally, the following actions have been added:
            -   `onCheckout()`: This action is called on both the normal channel and the processing channel when the user submits a payment option to pay for the product/service. `that` is an object with the following properties:
                -   `token`: The Stripe token that was created to represent the payment details. In the processing channel, this token can be passed to `server.finishCheckout()` to complete the payment process.
                -   `productId`: The ID of the product that is being purchased. This is useful to determine which product is being bought and which price to charge.
                -   `user`: (Processing channel only) Info about the user that is currently purchasing the item. It is an object containing the following properties:
                    -   `username`: The username of the user. (Shared for every tab & device that the user is logged into)
                    -   `device`: The device ID of the user. (Shared for every tab on a single device that the user is logged into)
                    -   `session`: The session ID of the user. (Unique to a single tab)
            -   `onPaymentSuccessful()`: This action is called on the processing channel when payment has been accepted after `server.finishCheckout()` has completed. `that` is an object with the following properties:
                -   `bot`: The bot that was created for the order.
                -   `charge`: The info about the charge that the Stripe API returned. (Direct result from [`/api/charges/create`](https://stripe.com/docs/api/charges/create))
                -   `extra`: The extra info that was included in the `server.finishCheckout()` call.
            -   `onPaymentFailed()`: This action is called on the processing channel when payment has failed after `server.finishCheckout()` was called. `that` is an object with the following properties:
                -   `bot`: The bot that was created for the error.
                -   `error`: The error object.
                -   `extra`: The extra info that was included in the `server.finishCheckout()` call.
    -   Added the ability to send commands directly to users from the server via the `remote(command, target)` function.
        -   For example, calling `remote(player.toast("hi!"), { username: 'test' })` will send a toast message with "hi!" to all sessions that the user "test" has open.
        -   This is useful for giving the user feedback after finishing the checkout process.
        -   Currently, only player commands like `player.toast()` or `player.goToURL()` work. Shouts and whispers are not supported yet.

## V0.9.38

### Date: 09/16/2019

### Changes:

-   Improvements
    -   Added the ability for the directory client to automatically connect to an AUX Proxy.
        -   Can be controlled by using the `PROXY_TUNNEL` environment variable which should be set to the WebSocket URL that the client should try to tunnel to.
        -   Also needs to have the `UPSTREAM_DIRECTORY` environment variable set to the URL of the directory that the client should register with and get its tokens from.
        -   The `casualsimulation/aux-proxy` docker image is a tunnel server that can handle automatically accepting and managing tunnels for directory clients.
        -   For example, you can get a basic tunnel system going by setting up the `casualsimulation/aux-proxy` docker image at a URL like `proxy.auxplayer.com` and setting the `PROXY_TUNNEL` environment variable for the `casualsimulation/aux` image to `wss://proxy.auxplayer.com`.
            -   When the client grabs a token from the configured `UPSTREAM_DIRECTORY`, it will then try to connect to `wss://proxy.auxplayer.com` to establish a tunnel for the `external-{key}` subdomain.
            -   Once the tunnel is established, any traffic directed at `external-{key}.auxplayer.com` which is routed to the same server that hosts `proxy.auxplayer.com` will be forwarded onto the tunnel client which will then server the AUX experience.
            -   In effect, this lets a AUXPlayer experience hosted from an internal network be accessible from outside the network via using a reverse tunnel server. (This lets us get around NAT without things like UPNP)
-   Bug Fixes
    -   Copying the workspace will now copy the context bot as well.
    -   Removing a bot via code it should no longer set the selection to a mod.

## V0.9.37

### Date: 9/13/2019

### Changes:

-   Improvements
    -   Added an AUX Proxy web service that can temporarilly authorize a proxy connection for a local AUX.
    -   Added a package that provides the ability to create tunnels via websockets.

## V0.9.36

### Date: 9/13/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue with dragging files on a non-default grid scale in AUXPlayer.

## V0.9.35

### Date: 9/11/2019

### Changes:

-   Improvements
    -   Changing the player inventory's height via the height slider will now set the inventory items to be correctly bottom aligned.
-   Bug Fixes
    -   Resolved issues with dragging bots and minimized contexts onto the background in builder.
    -   Resolved issues with sizing differences of the player inventory between pc and mobile platforms.
    -   Fixed the directory client to send the correct IP Address.
    -   Fixed the directory service to handle errors when sending webhooks.

## V0.9.34

### Date: 9/10/2019

### Changes:

-   Improvements
    -   Added the ability to set which IP Addresses should be trusted as reverse proxies.
        -   Setting this value will allow the server to determine the actual IP Address of visiting users and which protocol they are actually using to load data.
        -   Can be controlled with the `PROXY_IP_RANGE` environment variable.
            -   Supports a single IP Address, or a CIDR IP Address range.

## V0.9.33

### Date: 9/10/2019

### Changes:

-   Improvements
    -   Added a service which can send information to the configured directory at periodic intervals.
        -   By default, the information gets sent on startup and every 5 minutes afterwards.
            -   `key`: The SHA-256 hash of the hostname plus the loopback interface's MAC address.
            -   `password`: The password that was generated on the device to authenticate to the directory.
            -   `publicName`: The hostname of the device.
            -   `privateIpAddress`: The IPv4 Address of the first non-loopback interface sorted by interface name. This is supposed to be the LAN IP that the device has.
        -   The directory that the client reports to (the upstream) can be configured using the `UPSTREAM_DIRECTORY` environment variable. If it is not set, then the client is disabled in production.

## V0.9.32

### Date: 9/10/2019

### Changes:

-   Improvements
    -   Changed and condensed the action tags: `onDropInContext()`, `onAnyDropInContext()`, `onDropInInventory()`, `onAnyDropInInventory()`, `onDragOutOfContext()`, `onAnyDragOutOfContext()`, `onDragOutOfInventory()` and `onAnyDragOutOfInventory()` to `onBotDrop()`, `onAnyBotDrop()`, `onBotDrag()`, `onAnyBotDrag()`.
    -   Setup new 1x7 player inventory layout, works with dynamic changes to width, currently not working with dynamic changes to height.
    -   Changed range of `aux.context.inventory.height` from 0 to 1 to instead be 1 to 10 defining the default number of rows to view in the inventory on page load.
    -   Added an API for the AUX Directory.
        -   Stores a list of AUXes and their IP addresses to make it easy to discover AUXPlayers that share the same public IP address with you.
        -   Controllable with the `DIRECTORY_TOKEN_SECRET` and `DIRECTORY_WEBHOOK` environment variables.
        -   If the `DIRECTORY_TOKEN_SECRET` environmenv variable is not specified, then the directory API will not be enabled.
        -   Make sure to use a long secure random value for the `DIRECTORY_TOKEN_SECRET`.
        -   The `DIRECTORY_WEBHOOK` variable specifies the URL that updated entry information should be POSTed to.
            -   The message contains a JSON object with the following data:
                -   `key`: The key/hash that the uniquely identifies the AUX that was updated.
                -   `externalIpAddress`: The external (public facing) IP Address that the AUX is using.
                -   `internalIpAddress`: The internal (non-public facing) IP Address that the AUX is using.
        -   The following API Endpoints have been added:
            -   `GET /api/directory`
                -   Gets a list of AUXPlayers that share the same public IP Address as you.
                -   Each entry in the list contains the name of the AUXPlayer and the URL that it can be accessed at.
            -   `PUT /api/directory`
                -   Creates / Updates the entry for an AUXPlayer.
                -   The request must contain the following values as a JSON object:
                    -   `key`: The unique key identifying the AUXPlayer. Recommended to use a hash of the MAC address and hostname.
                    -   `privateIpAddress`: The local network IP Address that has been assigned to the AUXPlayer.
                    -   `publicName`: The name that can be shown to other users publicly.
                    -   `password`: The password that is required to update the record. If this is the first request for the `key` then the password will be saved such that the record can only be updated in the future when given the same password.
-   Bug Fixes
    -   Unbound `aux.context.player.rotation.x` and `aux.context.player.rotation.y` from one another to let the user only need to fill in one of the fields for player's initial rotation to work.

## V0.9.31

### Date: 9/05/2019

### Changes:

-   Improvements
    -   Added in a `mod.subtract` function to removed certain tags defined by a mod.
    -   Added the ending grid position to the drag and drop context actions.
    -   Added the new `createdBy()` function that get the filter of bots that have been created by another bot.
    -   Set the drag and drop actions to return more consistant variables.
    -   Removed the hamburger menu icon and the menu text from the player's menu.
    -   Player's menu will now open then items are added to it from an empty state.
    -   Removed unneeded function from the project: `getBotsInContext`, `getBotsInStack`, `getFilessAtPosition`, `getNeighboringBots`.
-   Bug Fixes
    -   Set the bot in the drag and drop actions to no longer return multiple bots.
    -   Cleaned up missed text artifact on the loading popup in player.
    -   Setting the initial zoom of the player in the context without setting anything for the rotation will no longer rotate the initial player.
    -   Resolved issue with wall height not getting set correctly when the context the bot is on is moved vertically.
    -   Fix issue with the bot returned from a drag and drop action.
    -   Sheet will now remain open when deleting a bot.
    -   Fixed `onCombine()` actions to pass the other bot as `that.bot`.

## V0.9.30

### Date: 08/28/2019

### Changes:

-   Improvements
    -   Split the player inventory's resizing bar into two and placed them at the top corners of the inventory.
    -   Halved the inventory's gap spacing when on moble for a larger inventory.
    -   Improved the label textbox to resize to fix bot that have a high width value.
    -   The drop action tags: `onDropInContext()`, `onAnyDropInContext()`, `onDropInInventory()` and `onAnyDropInInventory()` now return the previous context the bots were in before the drop.
    -   Allow the context to set the player's default zoom with the tag `aux.context.player.zoom` and its rotation with the tags `aux.context.player.rotation.x` and `aux.context.player.rotation.y`.
    -   Changed the loading popup to have improved readability and removed wanted information from the player's loading popup.
    -   Added the ability to show and scan barcodes.
        -   Barcodes can be shown via the `player.showBarcode(code, format)` function.
            -   The `format` parameter accepts the following options:
                -   [`code128`](https://en.wikipedia.org/wiki/Code_128) (Code 128) (default)
                -   [EAN](https://en.wikipedia.org/wiki/International_Article_Number)
                    -   `ean13` (EAN-13)
                    -   `ean8` (EAN-8)
                    -   `upc` (UPC-A)
                -   [`itf14`](https://en.wikipedia.org/wiki/ITF-14) (ITF-14)
                -   [`msi`](https://en.wikipedia.org/wiki/MSI_Barcode) (MSI)
                -   [`pharmacode`](https://en.wikipedia.org/wiki/Pharmacode) (Pharmacode)
                -   [`codabar`](https://en.wikipedia.org/wiki/Codabar) (Codabar)
        -   The barcode scanner can be opened via the `player.openBarcodeScanner()` function.
            -   The following barcode types can be scanned:
                -   Code 128
                -   Code 39
                -   Code 93
                -   EAN-13
                -   EAN-8
                -   UPC-A
                -   UPC-C
                -   Codeabar
            -   When a barcode is scanned the `onBarcodeScanned()` event will be sent containing the barcode that was detected.
            -   Also supports `onBarcodeScannerOpened()` and `onBarcodeScannerClosed()`.
    -   Added menus back to AUXPlayer.
    -   Added `byMod()` as an additional way to query bots.
        -   Convienent way to query bots by multiple tags at once.
        -   Usage:
            -   `getBots(byMod({ "aux.color": "red", "aux.scale": 2 }))` gets all the bots with `aux.color` set to `"red"` and `aux.scale` set to `2`.
            -   `getBots(byMod({ "aux.color": null, "aux.label": "Hi!" }))` gets all the bots without an `aux.color` but with `aux.label` set to `"Hi!"`.
-   Bug Fixes
    -   Resolved issue with new contexts adding an incorrect tag to the sheet.
    -   Changed the dynamic aspect ratio to a stable one for the inventory scaling.

## V0.9.29

### Date: 08/23/2019

### Changes:

-   Improvements
    -   Changed `hasFileInInventory()` function to `hasBotInInventory()`.
    -   Changed `onMerge()` action tag to `onMod()`.
    -   Changed `aux._editingFile` hidden tag to `aux._editingBot`.
    -   Gave the player inventory an offset from the bottom of the window so that it is floating.
    -   Deselecting one of 2 bots in multiselection mode will return the the sheet to single selection mode.
    -   Removed the direct aux view for now.
    -   Added new feature in sheet where clicking on a bot's tag will select all bots with that tag.
    -   Added a code editor.
        -   Loads only on desktop/laptop.
        -   For the best experience, use with the full size sheet.
        -   Features:
            -   Syntax highlighting for action tags and formulas.
                -   Normal tags don't get syntax highlighting.
            -   Syntax checking.
            -   Autocomplete for tags.
                -   Triggered by typing `#` or by pressing `Ctrl+Space`.
            -   Autocomplete for formula/action API functions.
                -   Triggered by typing or by pressing `Ctrl+Space`.
            -   Find references to API functions across actions/formulas.
                -   Trigger by putting the cursor on the tag and press `Shift+F12`.
            -   Find references to tags across actions/formulas.
                -   Trigger by putting the cursor on the tag and press `Shift+F12`.
            -   Auto formatting
                -   Trigger by typing `Alt+Shift+F`.
            -   Find & Replace
                -   Open the find tool by pressing `Ctrl+F`.
                -   Go to replace mode by toggling the arrow on the left side of the find tool.
        -   Other notes
            -   It is not currently possible to remove formulas using the code editor. Instead, you have to use the small tag input in the table to completely remove formulas.
    -   Changed menu button text of: `Channel doesn't exist. Do you want to create it?` to `Channel doesn't exist. Click here to create it.` for better user direction.
-   Bug Fixes
    -   Resolved issue of the `getBot()` function not working in the search bar.
    -   Allow the use of a channelID made up entirely of numbers.
    -   Resolved issue of `setTag()` not working with multiple files when fed a false or null value to set.
    -   Deleting a bot when in multiselection mode will no longer close the sheet.
    -   The `onPointerExit()` function will now execute before an `onPointerEnter()` function when hovering over multiple bots.
    -   Fixed issue in the `RemoveTags()` function where providing a string with a `.` in its tag section failed to remove the correct tags.
    -   The tag `aux.context` can now be set to a value type of boolean or number.
    -   Increased the timeout time on the `Create Channel` toast message to give it more processing time so it works more consistently.
    -   Fixed inconsistency between actual action tag `onAnyDropInContext` and what was appearing in the tag dropdown `onDropAnyInContext` to read correctly, and other similar cases of this.
    -   Changed the tag `aux.context.inventory.height` to work in the context bot's tag list.

## V0.9.28

### Date: 08/16/2019

### Changes:

-   Improvements
    -   Added the `onPointerUp()` action tag to fire on button release.
-   Bug Fixes
    -   Resolved issue where creating a new tag on one bot, deselecting all bots and attempting to add that same tag to a different bot resulted in a warning.
    -   Resolved issue stopping VR from functioning on Occulus Quest.

## V0.9.27

### Date: 08/14/2019

### Changes:

-   Improvements
    -   Added the context to the `that` of the `onAnyBotClicked()` action tag.
    -   Added the context to the `that` of the `onKeyDown()` and `onKeyUp` action tags.
    -   Removed the trashcan area that appears when dragging a bot.
    -   Added the bot and context to the `that` of the `onPointer` action tags.
    -   Improved the functionality of `getBots()` and `getBot()` by adding the ability to search by multiple parameters.
        -   [Github Issue](https://github.com/casual-simulation/aux/issues/8)
        -   The following functions have been added:
            -   `byTag(tag, value)`: Filters for bots that have the given tag and value.
            -   `inContext(context)`: Filters for bots that are in the given context.
            -   `inStack(bot, context)`: Filters for bots that are in the same stack as the given bot in the given context.
            -   `atPosition(context, x, y)`: Filters for bots that are at the given position in the given context.
            -   `neighboring(bot, context, direction)`: Filters for bots that are neighboring the given bot in the given context in the given direction.
            -   `either(filter1, filter2)`: Filters for bots that match either of the given filters.
            -   `not(filter)`: Filters for bots that do not match the given filter.
        -   As a result, it is now possible to use `getBots()` like this:
            -   `getBots(byTag("abc", 123), byTag("name", "test"))`
            -   `getBots(not(inContext("hello")))`
            -   `getBots(inContext("hello"), not(inStack(this, "hello")))`
            -   `getBots(atPosition("test", 1, 2))`
            -   `getBots(either(byTag("abc", true), byTag("def", true)))`
        -   You can still use the old syntax like `getBot("name", "bob")`.
    -   Improved the server to update a tag indicating whether a user is active or not.
        -   The tag is `aux.user.active` and is on every player bot.
        -   The user frustums have been updated to use this value for detecting if a player is active or not.
    -   Removed the depreciated tags: `aux.context.surface.grid`, `aux.context.surface.defaultHeight`, `aux.input`, `aux.input.target`, and `aux.input.placeholder`.
    -   Made the text editor in sheet go all way to the bottom of the screen when the sheet is toggled to fullscreen mode.
    -   Removed the `event()` function from action scripts.
-   Bug Fixes
    -   Destroying a bot will no longer keep a mod of the bot in the selection.
    -   Modballs will no longer appear as the file rendered when searching for bots.
    -   Added the missing `onPointerDown()` tag to the tag dropdown list.
    -   Fixed an issue that would cause the browser to be refreshed while in the process of Forking an AUX.
    -   The `player.currentChannel()` function will now work in builder.
    -   Fixed actions to be able to support using comments at the end of scripts.
    -   When clicking off of a search for config it will no longer show a mod being selected briefly.

## V0.9.26

### Date: 08/09/2019

### Changes:

-   Improvements
    -   Changed the "Subscribe to Channel" text to "Add Channel" in AUXPlayer.
    -   Changed the "powered by CasualOS" tagline to "CasualOS ☑️".
    -   Added the ability to copy/paste bots directly onto surfaces.
    -   Control clicking a bot and attempting to drag it will now result in cloning the bot.
    -   Removed the outline bars on the player inventory.
    -   Dragging files in AUXPlayer now pulls the selected bot out of the stack.
    -   Updating the `aux.scale.z` or `{context}.z` values on bots now updates the other bots in the same stack.
    -   Improved the sheet to show the filter buttons for every tag namespace.
    -   Added the ability to undo destroying a bot from the sheet.
    -   Changed the "channel does not exist" message to include a better call to action.
    -   Zooming and rotation from a `player.tweenTo()` call can now be canceled by user input.
-   Bug Fixes
    -   The zoom value and orbital values of the `player.tweenTo()` function have been clamped to their set limits to avoid issues.
    -   The inconsistancy of zoom number input between perspective and orthographic cameras with the `tweenTo` function has been fixed.
    -   Fixed the create channel button to refresh the page so that the channel is properly loaded.

## V0.9.25

### Date: 08/08/2019

### Changes:

-   Bug Fixes
    -   Fixed a spelling error in the hamburger menu.
    -   Fixed an issue that would cause recursive formulas to lock-up the channel.

## V0.9.24

### Date: 08/08/2019

### Changes:

-   Improvements
    -   Changed `onPlayerContextEnter()` to `onPlayerEnterContext()`.
    -   Added `player.currentChannel()` for users to query the channel id in player.
-   Bug Fixes
    -   Dragging a mod should no longer show a change in the scale.
    -   Fixed an issue that would show the wrong username if logging in as a guest.
    -   Fixed the "Fork Channel" button to create the new channel.
    -   Changed the "Fork Channel" and "Clear Channel" buttons to only allow admins to run them.
    -   Fixed an issue that would cause the tag input boxes to not accept typing an `=` sign as the first character.
    -   Fixed the `Destroyed {bot ID}` messages to not show when the bot doesn't actually get destroyed.
    -   Getting the mod of a recently changed file will no longer be missing tags.
    -   Fixed isse with new tag input remaining open when verifying a tag vai the enter key.
    -   Fixed issue where `aux.stackable` being false stopped mods from being applied to the bot, mods can now be applied.

## V0.9.23

### Date: 08/06/2019

### Changes:

-   Improvements
    -   Changed `Clear Mod` to `Reset` in the sheet.
    -   Allow the clicking on a bot in the sheet in single selection mode to deselect the bot.
    -   Changed `onCombine()` action tag to `onCombine(#tag:"value")` and set the autofill to not auto add this tag to the sheet.
    -   Added the `aux.context.devices.visible` to allow the hiding of user bots in the player.
-   Bug Fixes
    -   Dragging a bot with no bot selected will no longer select a mod of the dragged bot.

## V0.9.22

### Date: 08/06/2019

### Changes:

-   Improvements
    -   Changed `{context}.index` to `{context}.sortOrder`.
    -   Added another variable to `onClick()` action tag to return a context.
    -   Added another variable to `onCombineEnter()` and `onCombineExit()` action tags to return a context.
    -   Added `onAnyPlayerContextEnter` to trigger on every bot when a player joins a context and changed `onPlayerContextEnter` to trigger on the player bot that joins a context.

## V0.9.21

### Date: 08/05/2019

### Changes:

-   Improvements
    -   Improved the `server.shell()` command to output a bot to the `aux.finishedTasks` channel with the results of the command.
    -   Added the ability to backup channels to Github using Gists.
        -   You can trigger a backup by running `server.backupToGithub(token)` as an admin from the admin channel.
        -   The `token` parameter should be replaced with a string containing a [personal access token](https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line) from the account you want the backup to upload to.
        -   During upload a bot will be added to the `aux.runningTasks` context with a progress bar indicating the status of the operation.
        -   When the task is completed the bot will be moved to the `aux.finishedTasks` context and will contain tags indicating the result of the operation.
        -   After finishing the bot will contain a link to the uploaded data.
    -   Added the ability to backup channels as a zip file.
        -   Triggered by running `server.backupAsDownload()` as an admin from the admin channel.
        -   Similar to the Github backup but the zip file is downloaded to your device.
    -   `setTag` function will now accept an array of bots as it's first paramater.
    -   Removed the white circle background from the player's menu button.
    -   Changed `Fork/Upload/Download AUX` to `Fork/Upload/Download Channel`.
    -   Updated connection message.
    -   Allow the deselection of files by clicking on the bot in the sheet during multiselection.
    -   Greatly improved the performance of dragging stacks of bots in AUXPlayer.
    -   Added the `onCombineEnter()` and `onCombineExit()` action tags to fire on all bots being interacted with during a drag operation with combine action tags involved.
-   Bug Fixes
    -   Removed mouse pointer change on player inventory side bars.
    -   Made the multiselect button ui consistant colors.
    -   Made the multiselect button hide itself in multiselect mode.
    -   `aux.label` will now accept numbers as a tag value.
    -   Further restrict the add tag setup to stop unwanted warning popups.
    -   Fixed to let admin users be designers even if the designers list says otherwise.

## V0.9.20

### Date: 07/31/2019

### Changes:

-   Improvements
    -   Increased the Socket.io ping interval and timeout values to better support sending large causal trees.
    -   Updated `aux.inventory.height` to `aux.context.inventory.height`.
    -   Removed the raise and lower option in the context dropdwon menu.
    -   Changed player menu's `Add Channel` to `Subscribe to Channel`.
    -   Set mobile and desktop's default player inventory height to be consistent.
    -   Added a basic console that can be used to view logs from scripts and formulas.
        -   The console can be opened via the `player.openDevConsole()` script function.
    -   Changed the toggle size button's image.
    -   Moved multiselection button to the top right, added new icon for the button.
    -   Added bot image to top of sheet.
    -   Removed deslection button, the minus icon, from the sheets.
    -   Changed destroy bot button text to the trash can icon.
    -   Allow the user to drag bots from the bot image at the top of the sheet section.
-   Bug Fixes
    -   Improved centering of loading popup's `powered by CasualOS` text.
    -   Fixed an issue that would cause `player.currentContext()` to not update until after the `onPlayerContextEnter()` event was fired.
    -   Fixed some issues with the login flow for AUXPlayer.

## V0.9.19

### Date: 07/29/2019

### Changes:

-   Improvements
    -   Added the ability for shouts and whispers to return values.
        -   `shout()` returns a list of results from every bot that ran a script for the shout ordered by bot ID.
        -   `whisper()` returns a list of results from every bot that ran a script for the whisper ordered by the input bot array.
        -   To return a value from a shout/whisper handler, use `return` statements. For example, to return `10` from a shout you would simply write `return 10`.
    -   Changed the tag suggestion list to only show when there are tags that match the input.
    -   Changed the create surface popup's header text to read: `Create Context from Selection`.
    -   Added show surface checkbox to the create context popup.
    -   Removed the text on the sheet's bottom left add tag button.
    -   Added the phrase `powered by CasualOS` to bthe hamburger menu and loading popup.
    -   Removed `Unselect All` from the sheets.
-   Bug Fixes
    -   Fixed an issue that would let users load the admin channel because no file specified session limits for it.
    -   Fixed an issue that would cause formulas which contained indexer expressions to fail.
    -   Fixed the server to not overwrite broke Causal Trees.
    -   Stopped incorrect empty tag warning when attempting to add in a new tag.
    -   Fixed there not being a visible right bar on the player inventory.
    -   Fixed dependency tracking for formulas which get bots by ID. (like `getBots("id")`)

## V0.9.18

### Date: 07/25/2019

### Changes:

-   Bug Fixes
    -   Reverted a change that had the potential to corrupt a tree upon load.

## V0.9.17

### Date: 07/25/2019

### Changes:

-   Improvements
    -   Added the ability to execute remote events on the server.
        -   This lets us do all sorts of administrative tasks while keeping things secure.
        -   These events are sent via scripts.
        -   Depending on the action, it may only be possible to execute them in the correct channel. For example, executing admin tasks is only allowed in the admin channel to help prevent things like clickjacking.
        -   The following functions are supported:
            -   Admin channel only
                -   `server.grantRole(username, role)`: Grants the given role to the user account with the given username if the current player is an admin.
                -   `server.revokeRole(username, role)`: Revokes the given role from the user account with the given username if the current player is an admin.
                -   `server.shell(script)`: Runs the given shell script on the server if the current player is an admin.
    -   Improved the login system to dynamically update based on changes to the admin channel.
        -   This lets us do things like lock user accounts or tokens and have the system automatically handle it.
        -   It even supports formulas!
        -   The login system uses the following tags on bots in the admin channel:
            -   `aux.account.username`: This tag indicates that the bot is a "user account" bot for the given username.
            -   `aux.account.roles`: This tag indicates which roles an account should be granted.
            -   `aux.account.locked`: This tag indicates whether the account is locked and that logging in using it should not be allowed.
            -   `aux.token`: This tag indicates that the bot is a "token" which can be used to login to a user account.
            -   `aux.token.username`: This tag indicates the username of the user account that the token is for.
            -   `aux.token.locked`: This tag indicates whether the token is locked and therefore cannot be used to login to the account.
    -   Improved the login system to automatically give guests the `guest` role.
        -   This allows blocking guests via the `aux.blacklist.roles` tag on the channel config file.
    -   Improved the channel system to only allow loading a channel if it has been created via a bot in the admin channel.
        -   This lets admins control which channels are accessible.
        -   The admin channel is always accessible, but only to admins. This is a safety measure to prevent people from locking themselves out.
        -   To make a channel accessible, load the admin channel and create a bot with `aux.channel` set to the channel you want and `aux.channels` set to `true`.
        -   Alternatively, load the channel you want and click the `Create Channel` toast that pops up. (only works if you're an admin)
    -   Added the ability to view and control how many sessions are allowed.
        -   Allows setting a max sessions allowed value for channels and the entire server.
        -   Per-Channel settings go on the channel file in the admin channel.
            -   The `aux.channel.connectedSessions` tag indicates how many sessions are active for the channel.
            -   The `aux.channel.maxSessionsAllowed` tag specifies how many sessions are allowed for the channel. Admins are not affected by this setting. If this value is not set then there is no limit.
        -   Global settings go on the `config` file in the admin channel.
            -   The `aux.connectedSessions` tag indicates how many sessions are active for the server.
            -   The `aux.maxSessionsAllowed` tag specifies how many sessions are allowed for the entire server. Admins are not affected by this setting. If this value is not set then there is no limit.
    -   Added the ability to query the status information from the server.
        -   Requests to `/api/{channelId}/status` will return a JSON object containing the current number of active connections for the channel.
        -   Requests to `/api/status` will return a JSON object containing the current number of active connections for the server.
    -   Changed `aux.inventory.color` tag to `aux.context.inventory.color`, and allowed the editing of the invenroty color to be done in the context bot's tags.
    -   Added an `aux.context.inventory.visible` tag to toggle the player inventory on and off, it will default to visible.
    -   Reduced width of player inventory and added a left alligned line to it's left side.
    -   Gave the player inventory the ability to be set by a user set inventory context tag.
    -   Added a width maximum to the player inventory.
    -   Added in the `onAnyBotClicked()` function to fire an event when any bot in the scene has been clicked.
-   Bug Fixes
    -   The player's background context color can now be set via fomula.
    -   Fixed scripts to remove deleted files from queries like `getBots()` or `getBot()`.
    -   Fixed the login screen to hide the loading progress when the user needs to scan the token from their other device.
    -   Improved the JavaScript sandbox to prevent common infinite loops.
        -   Loops in JavaScript code now have an energy cost of 1 per iteration.
        -   By default, each formula/action has an energy of `100,000`.
        -   Shouts get their own energy value set at `100,000`. (for now - so it's still possible to get around the energy limit by shouting back and forth)
        -   Exceeding the energy limit causes the formula/action to be terminated so that the application doesn't get locked up.
    -   Corrected misspelled tag name in the tag dropdown list.
    -   Fixed positioning issue with setting `aux.label.anchor` via an interaction.

## V0.9.16

### Date: 07/22/2019

### Changes:

-   Improvements

    -   Added ability to use the enter key on the new tag dropdown to autofill the tag.
    -   The webpage's tab name will now display the channel's ID in designer and the Context name and ID in Player.

-   Bug Fixes
    -   Added another Wall3D optimization with a geometry disposal.
    -   Added a null check to stop an error when trying to drag specifically removed bots.
    -   A mod object will no longer change it's mesh scale while being dragged.
    -   Fixed an issue that would happen if a file was updated and deleted in the same script.

## V0.9.15

### Date: 07/18/2019

### Changes:

-   Improvements
    -   Selecting a tag from the tag suggestions list will now automatically add the tag on click.
    -   Added a plus sign to the `Make mod from selection` butotn's icon.
-   Bug Fixes
    -   Improved Wall3D performance, should no longer take up most memory allocation.
    -   Clicking on a bot will no longer have the mereg ball appear for a second in the file count.

## V0.9.14

### Date: 07/17/2019

### Changes:

-   Improvements
    -   Added a login system
        -   Users are first-come first-serve.
            -   Upon login your device will generate a token that is used to authenticate the device for that user account.
                -   Because this token is unique and secret you must use the new "Login with Another Device" feature in the side menu.
                -   This will show a QR code that can be scanned after trying to login with the same username.
            -   Users can be granted roles via their bot in the `admin` channel.
                -   These roles can be used to allow or deny access to channels.
                -   Users that have the `admin` role are allowed access to every channel. (and bypass the blacklist and whitelist)
        -   The server now decides if a user is able to load an aux.
            -   This means that the server checks `aux.blacklist` and `aux.whitelist` before sending the data.
            -   The following tags have been added to check whether a user is allowed access based on their roles.
                -   `aux.whitelist.roles`: Specifies the list of roles that users must have all of in order to access the channel.
                -   `aux.blacklist.roles`: Specifies the list of roles that users must not have any of in order to access the channel.
            -   By default, the `admin` channel is set to allow only users with the `admin` role.
    -   The login screen now remembers which users you have logged in with previously.
        -   Because tokens are saved on the device it is important to save users and only remove them if explicitly requested by the user.
    -   The `aux.line.style` tag's wall settting will now dynamically scale with bot height and bot stacking.
    -   The inventory viewport now no longer accepts panning input, it will now only zoom and rotate.
    -   Added in an `aux.line.style` tag that changes the design of the `aux.line.to` line.
    -   Added in a resize sheets button to set sheet's to full page width at all times.
    -   Added in an `aux.line.width` tag that changes the width of the `aux.line.to` but only the wall style for now.
    -   Resize the sheets button is now on the far left of the sheets buttons.
    -   Added a new `Make mod from selection` button to the sheet's buttons.
    -   Clicking off of the sheets will now always revert the selected item to an empty bot.
    -   Clicking the `enter` key on a selected tag will automatically open up the `new tag` input section.
    -   Clicking the `escape` key when the `new tag` input section is up will close the input section.
    -   The `new tag` input section will now be left alligned in the sheets.
    -   The tag section buttons will now appear below the bot content in the sheets.
    -   Moved the sheet's `Toggle Size` button to the right side of the sheet.
-   Bug Fixes
    -   Fixed `create()` to dissallow overriding `aux.creator` when a creator is specified.
    -   The center button will no longer effect the rotation in channel designer's viewport.
    -   'Enable AR' button no longer shows up in iOS Chrome which is currently unsupported.
    -   Fixed AR rendering for both AUX Designer and AUX Player.
    -   Fixed the login page to redirect to Channel Designer if the user refreshes the page while on the login screen.
    -   Fixed an issue that would cause `player.currentContext()` to be undefined if it was accessed inside `onConnected()`.
    -   Fixed the link to the `aux-debug` page in Channel Designer.
    -   Fixed an issue where formulas which had circular dependencies would cause other tags referencing the circular tag to not update.
    -   Fixed the parsing logic for filter tags to support curly quotes. (a.k.a. "Smart Quotes" that the iOS keyboard makes)
    -   Adding a new tag to a bot will now automatically focus the new tag whereas before it would not focus it.
    -   Fixed the file table to not interrupt the user's typing when tag value updates are processed.
-   Security Fixes
    -   Updated the `lodash` NPM package to `4.17.14` to mitigate [CVE-2018-16487](https://nvd.nist.gov/vuln/detail/CVE-2018-16487).

## V0.9.13

### Date: 07/10/2019

### Changes:

-   Improvements
    -   Reordered the context menu list to new specifications.
    -   Renamed several items in the context menu list: `Open Context` to `Go to Context` and `Select Context Bot` to `Edit Bot`.
-   Bug Fixes
    -   The `aux.context.locked` will now be properly initially set via the create context popup's tick box.

## V0.9.12

### Date: 07/09/2019

### Changes:

-   Improvements
    -   Added a rotation option to `player.tweenTo`, users can now define an `x` and `y` rotation to define which way the camera views the bot.
    -   New context popup opens with`aux.context.locked` set to false and the text has been change to `Lock Context`.
    -   Changed `aux.mod.tags` to `aux.mod.mergeTags`.
    -   Renamed `aux.movable="mod"` to `aux.movable="cloneMod"`.
    -   `isDiff` function no longer checks for `aux.mod.mergeTags` when determining weather a bot is a diff or not.
    -   Added the `aux.listening` tag to disable, a bot will accept shouts or whispers if this tage is set to true but ignore them it `aux.listening` is set to false.
    -   Removed the `context_` prefix of the default generated name of new contexts.
-   Bug Fixes
    -   The cube that appears on empty bot will now be properly sized.
    -   The center inventory button will now appear when intended.
    -   Fixed typo on the `Requesting site ID` text.
    -   First entered letter on a new bot's label not appearing had been resolved.
    -   The function `onCombine` should not trigger when dragging on a stack of bots but a warning message explaining this has been added it this is attempted.
    -   Dragging the inventory top to change its size will no longer cause the Google Chrome mobile app to refresh the page.
    -   Added in a tween override when user attempts input during a tween that will stop the tween immediately.

## V0.9.11

### Date: 07/01/2019

### Changes:

-   Improvements
    -   Added two new functions that can be used to open URLs.
        -   `player.goToURL(url)`: Redirects the user to the given URL in the same tab/window.
        -   `player.openURL(url)`: Opens the given URL in a new tab/window.
-   Bug Fixes
    -   Fix actions that edit files which get destroyed to not error and cause the rest of the action to fail.

## V0.9.10

### Date: 06/29/2019

### Changes:

-   Bug Fixes
    -   Make the sandboxed iframe fix check if the OS is iOS in addition to checking for Safari. This detects Chrome iOS and therefore applies the workaround.

## V0.9.9

### Date: 06/28/2019

### Changes:

-   Bug Fixes
    -   Make our minifier output ASCII so that Safari can load the web worker from a blob. (which apparently requires ASCII)

## V0.9.8

### Date: 06/28/2019

### Changes:

-   Improvements
    -   Can now click on and drag multiple files at a time, one for each VR controller.
-   Bug Fixes
    -   Fixed loading on Firefox browsers.
        -   Added special case for Firefox browsers to ignore the use of browser crypto since it seems to cause errors despite it being supported.
    -   Always render VR controllers, even if they are not in view of the camera.
        -   This makes sure that you can still see controller pointer lines and cursors even if you are holding the controller out of view.
    -   Fixed loading on Safari by allowing the sandboxed iframe to do more than it should be able to.
        -   Related Bug: https://bugs.webkit.org/show_bug.cgi?id=170075

## V0.9.7

### Date: 06/28/2019

### Changes:

-   Bug Fixes
    -   Inventory camera updates properly again in AUXPlayer.
    -   Added some basic regex URL validation to `aux.iframe` tag.

## V0.9.6

### Date: 06/28/2019

### Changes:

-   **Breaking Changes**
    -   Removed `@` and `#` expressions.
        -   This means that `@id` and `#id` will no longer work.
        -   Instead, use `getBots("#id")` and `getBotTagValues("#id")`.
-   Improvements
    -   The inventory now begins with a top down view.
    -   The center viewport button will now set the rotation to be top down.
    -   Inventory now begins with an increased zoom value.
    -   Manually control when we submit the frame to the VRDisplay
        -   This allows us to be able to do multiple rendering passes on the WebGL canvas and have them all appear in VR correctly.
        -   Before this fix, any elements that were rendered onto the WebGL canvas after the first pass were absent from VR. This was because the `THREE.WebGLRenderer` prematurely submitted the frame to the `VRDisplay`. This was a problem because it appears that the WebVR API ignores subsequent calls to the `VRDisplay.submitFrame` function until the current frame has passed.
    -   Added the `hasTag` function to allow users to check if the file has a specific tag on it.
    -   Moved formula calculations to a background thread.
        -   This helps get a more consistent framerate by running formulas in the background while the scene is rendering.
        -   As a result, the `window` global variable will not be available formulas.
            -   This means formulas like `window.alert()` or `window.location` or `window.navigator.vibrate()` will not work anymore.
            -   This also means that channels are more secure since you should no longer be able to write a formula that directly modifies bots in another channel. (no crossing the streams)
        -   The new system works by tracking dependencies between formulas.
            -   It looks for calls to `getTag()`, `getBot()`, `getBots()` and `getBotTagValues()` to track dependencies.
            -   It is fairly limited and does not yet support using variables for tag names. So `getTag(this, myVar)` won't work. But `getTag(this, "#tag")` will work.
            -   There are probably bugs.
        -   Additional improvements include showing the error message produced from a formula.
            -   If the formula throws an error then it will show up instead of the formula text.
            -   The UI has not been updated so you cannot scroll to read the full error message.
    -   Improved line performance.
    -   Improved label positioning to be more consistent.
    -   Improved users to share inventories, menus, and simulations when they are logged in with the same username.
    -   Old inactive users will now be deleted automatically to keep the data model clear of unused users.
        -   This only affects bots that have the `aux._user` tag set.
    -   Improved our usage of Vue.js to prevent it from crawling the entire game tree to setup property listeners.
        -   This reduces rendering overhead significantly.
    -   Changed the size of the inventory's dragging bar.
-   Bug Fixes
    -   Fixed rendering warning that was caused by `aux.line.to` if the line was too short.
    -   The context will now no longer allow for bot placement if it is not being visualized.
    -   The bot's label should now always appear on page reload.
    -   The bot sheet should now no longer have an incorrect layout upon adding a new bot.
    -   The config ID in sheets will now read as `config` and not `confi`.
    -   Switching contexts in AUXPlayer will now add the old context to the browser history so you can use the back and forward buttons to go back and forth.

## V0.9.5

### Date: 6/19/2019

### Changes:

-   Improvements
    -   `onGridClick()` is now supported in VR.
    -   Changed `mergeBall` tag to `mod`.
    -   Changed `tags` staring tag to `mod`.
    -   Changed `Clear Tags` to `Clear Mod`.
    -   Stop users from adding a blank or only whitespace tag.
    -   Changed `tags.remove()` back to `removeTags()`.
-   Bug Fixes
    -   All camera tweens will now snap to their final (and literal) target destination at the end of the tween.
    -   Bots will get destroyed when dragged over the trashcan in AUX Builder even if it is still on a context surface.
    -   `aux.context.rotation` tags are now being used in AUX Builder to apply rotation to contexts.
    -   Tags starting with `_user` and all other appropriate hidden tags will now correctly sort into the hidden tags section in sheets.
    -   Clearing an empty mod with an added tag on it now clears the added tag.
    -   `aux.label.size.mode` set to `auto` now sizes properly with the orthographic camera.
    -   The inventory in player will now no longer reset it's scale upon resizing the inventory.

## V0.9.4

### Date: 06/18/2019

### Changes:

-   Improvements
    -   Label rendering is now longer overdrawn on the main scene.
        -   This fixes issues with rendering labels in VR.
-   Bug Fixes
    -   Labels are now rendered in both the left and right eye in VR.
    -   Fixed flickering labels due to z-fighting with the geometry it was anchored to

## V0.9.3

### Date: 06/18/2019

### Changes:

-   Improvements
    -   Changed labels to read "Bot" instead of "File".

## V0.9.2

### Date: 06/18/2019

### Changes:

-   **Breaking Changes**
    -   We changed how tags are used in formulas. Now, instead of using the dot (`.`) operator to access a tag in a file, you must use the new `getTag(file, tag)` and `setTag(file, tag)` functions.
        -   For example, instead of:
            -   `this.aux.color = "red"`
        -   You would use:
            -   `setTag(this, "#aux.color", "red")`
        -   Likewise for getting tags:
            -   `alert(this.aux.color)`
        -   You should now use:
            -   `alert(getTag(this, "#aux.color"))`
-   Improvements
    -   Added several functions indended to replace the @ and # expression syntax.
        -   `getBot(tag, value)`, Gets the first file with the given tag and value.
        -   `getBots(tag, value (optional))`, Gets all files with the given tag and optional value. This replaces the `@tag(value)` syntax.
        -   `getBotTagValues(tag)`, Gets all the values of the given tag. This replaces the `#tag` syntax.
        -   `getTag(file, tag)`, Gets the value stored in the given tag from the given file. This replaces using dots (`.`) to access tags.
        -   `setTag(file, tag, value)` Sets the value stored in the given tag in the given file. This replaces using dots (`.`) to set tag values.
    -   Renamed several functions to use the "bots" terminology instead of "files".
        -   `getFilesInContext() -> getBotsInContext()`
        -   `getFilesInStack() -> getBotsInStack()`
        -   `getNeighboringFiles() -> getNeighboringBots()`
        -   `player.getFile() -> player.getBot()`

## V0.9.1

### Date: 06/13/2019

### Changes:

-   Improvements
    -   VR mode is reimplemented.
        -   On a VR device, you can enter VR mode by clicking on `Enter VR` in the menu.
        -   VR controllers can be used to click on files as well as drag them around in both AUX Player and AUX Builder.
        -   `onPointerEnter()` and `onPointerExit()` work for VR controllers in AUX Player.
    -   AR mode is back to its previous working state (along with inventory!)
    -   Changed the function tag `player.isBuilder()` to `player.isDesigner()`.
    -   Clicking on the same file as the selected file will now open the sheet if it has been closed.
    -   Added a `Select Context File` seciton in the workspace dropdown. This will select the file responsible for the workspace and open up it's sheet.
    -   Added ability to drag to change the height of the inventory viewport in the player.
    -   Added a new `aux.inventory.height` tag that when applied to the config file will set a default height of the player's inventory.
-   Bug Fixes
    -   Clicking on the same file as the selected file will no longer deselect the file in single selection mode.
    -   Fixed accidental double render when running in AUX Builder.

## V0.8.11

### Date: 06/07/2019

### Changes:

-   Improvements
    -   Removed unused top grid spaces of empty an empty file.
    -   The tag autocomplete is now in alphabetical order.
    -   The id tag value is now centered in the sheets.
    -   The `Clear Diff` section of the sheets has been renamed `Clear Tags`.
    -   The tooltip for the surface button has been changed from `create surface from selection` to `create surface` in mergeBall mode.
-   Bug Fixes
    -   Changed the resulting `diff-` id of file to `merge` when adding tag to empty file.
    -   Changed header of the create worspace popup from `Create Surface from Selection` to `Create Surface` when opened on a merge file.

## V0.8.10

### Date: 06/07/2019

### Changes:

-   Improvements
    -   Change `diff` key word to `merge` or `mergeBall`.
        -   EX: The tag function `aux.diff` has been changed to `aux.mergeBall` and `aux.diffTags` has been changed to `aux.mergeBall.tags` and the `diff` id tag value has been changed to `merge`.

## V0.8.9

### Date: 06/06/2019

### Changes:

-   Improvements
    -   Changed `diff.save` and `diff.load` to `diff.export` and `diff.import` respectfully.
    -   Changed function `saveDiff` to automatically include the `loadDiff` function within it to clean up the resulting output.
    -   `diff.save` will now return a cleaner JSON than it was before.
-   Bug Fixes
    -   Duplicate tags will now not show up in a closed tag section's tag count.
    -   Stopped additon of extra whitespace on left side of screen when multi selecting too many files.

## V0.8.8

### Date: 06/05/2019

### Changes:

-   Improvements
    -   Improved how diffs are created from files so that they don't contain any tags which are for contexts.
        -   This means that moving a file will only give you a diff of tags that are not related to a context.
        -   Examples are `aux.color`, `aux.label`, etc.
        -   As a result, applying the diff to a file won't cause it to be moved.
    -   The hidden tag section has been changed from `aux._` to `hidden`.
    -   The action and hidden tag sections will now appear when only one tag meets the criteria for the section.
    -   The add tag auto complete will now check for a match of the start if the string and not a substring.
    -   The add tag autocomplete will hide the `aux._` tags until `aux._` is input.
    -   When clicking the background in multi-file selection mode, it will deselect the files and keep a diff of the last selected.
    -   Improved file diffs to keep the existing diff selected after merging it into a file.
    -   Added tag `aux.inventory.color` to global file that allows the user to set the inventory background color in player.
-   Bug Fixes
    -   Fixed an issue that would cause file diffs to apply their context positions to other files.
    -   Clicking the `minus` button of the final file in sheets will now switch to diff without the `minus` or `unselect all` buttons that don't do anything.

## V0.8.7

### Date: 06/05/2019

### Changes:

-   Improvements
    -   Added the ability to show hidden tags by toglging hidden tag section instead of the hidden tags button which has been removed.
    -   Edited hexagon button to be filled and have a larger plus icon to improve uniformity.
-   Bug Fixes
    -   Tag `#` section will no longer remain if there are no tags fitting the criteria.

## V0.8.6

### Date: 06/05/2019

### Changes:

-   Improvements
    -   Added the ability to automatically convert curly quotes (`U+2018`, `U+2019`, `U+201C`, `U+201D`) into normal quotes (`U+0008`, `U+0003`).
-   Bug Fixes
    -   Fixed an issue where tag diffs would appear like normal files.
    -   Fixed an issue that prevented users from moving the camera when tapping/clicking on a worksurface.

## V0.8.5

### Date: 06/04/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue that caused diffs to not be draggable from the mini file in the upper right hand corner of the screen.
    -   Fixed some conflicts between the default panel opening logic and the new dragging logic on mobile.
    -   Fixed an issue that prevented users from dragging file IDs out from the file panel on mobile.

## V0.8.4

### Date: 06/04/2019

### Changes:

-   Improvements
    -   Made AUX Builder remove any context-related tags when cloning/duplicating a file.
        -   This prevents diff files from magically appearing in other contexts when dragging them.
        -   It is accomplished by deleting any tag that is hidden (starts with an underscore) or is related to a context made by an `aux.context` tag in another file.
    -   Added `diff.save()` and `diff.load()` AUX Script functions.
        -   `diff.save(diffToSave)`: Takes the given diff and returns JSON that can be stored in a tag.
        -   `diff.load(diffToLoad)`: Renamed from `diff.create()`, `diff.load()` is now able to take some JSON and returns a diff that can be applied to a file using `applyDiff()`.
    -   Numbers in tags can now start with a decimal instead of having to start with a digit.
        -   For example, `.0123` is now allowed and equals `0.0123`.
    -   Added the ability to customize user colors via the following tags:
        -   `aux.color`: Setting this tag on a user's file will cause that user to be the given color.
        -   `aux.scene.user.player.color`: Setting this tag on the globals file will cause all users in AUX Player to appear as the given color.
        -   `aux.scene.user.builder.color`: Setting this tag on the globals file will cause all users in AUX Builder to appear with the given color.
    -   Made AUX Player users default to a yellow color instead of blue.
    -   Renamed the `globals` file to `config`.
    -   Renamed the following tags/actions:
        -   `aux.context.surface.{x,y,z}` -> `aux.context.{x,y,z}`
        -   `aux.context.surface.rotation.{x,y,z}` -> `aux.context.rotation.{x,y,z}`
        -   `aux._creator` -> `aux.creator`
        -   `aux.builders` -> `aux.designers`
        -   `onSave()` -> `onSaveInput()`
        -   `onClose()` -> `onCloseInput()`
    -   Changed the `"Switch to Player"` button text to be `"Open Context in New Tab"`.
    -   Changed the title of AUX Builder to `"Channel Designer"`.
    -   Improved the file table to automatically focus the first input for newly added tags.
    -   Added an `onDiff()` event that is triggered on the file that a diff was applied to.
        -   The `that` parameter is an object with the following properties:
            -   `diffs`: The array of diffs that were applied to the file.
-   Bug Fixes
    -   Fixed the color picker input to not error when the edited tag doesn't have a value.
    -   Fixed the color picker basic input subtype to have the correct width so that the colors line up properly.
    -   Fixed an issue with showing an input box during the `onSaveInput()` or `onCloseInput()` callback from another input.
    -   Added in ability to drag file or diff out of file selection dropdown button.
    -   The sheet section will now hide itself when dragging a file from it and reopen itself when the drag is completed.
    -   Changed `Create Workspace` button tooltip to `Create Surface from Selection`.
    -   Removed the `Destroy File` and `Clear Diff` buttons from an empty diff sheet.
    -   Removed the `Destroy File` and replaced it with the `Clear Diff` button on a non-empty diff sheet.
    -   Fixed `player.tweenTo()` from affecting the inventory camera if the target file doesnt exist in it.

## V0.8.3

### Date: 06/03/2019

### Changes:

-   Improvements
    -   Replaced `aux.context.surface` with `aux.context.visualize`
        -   This allows specifying how a context should be visualized in AUX Builder.
        -   The previous option only allowed specifying whether a context is visualized, not how.
        -   There are currently 3 possible options:
            -   `false`: Means that the context will not be visible in AUX Builder. (default)
            -   `true`: Means that the context will be visible in AUX Builder but won't have a surface.
            -   `surface`: Means that the context will be visible with a surface in AUX Builder.

## V0.8.2

### Date: 05/31/2019

### Changes:

-   Improvements
    -   Added `onGridClick()`
        -   Triggered when the user clicks on an empty grid space in AUX Player.
        -   Runs on every simulaiton.
        -   The `that` parameter is an object with the following properties:
            -   `context`: The context that the click happened inside of. If the click occurred in the main viewport then this will equal `player.currentContext()`. If the click happened inside the inventory then it will equal `player.getInventoryContext()`.
            -   `position`: The grid position that was clicked. Contains `x` and `y` properties.
    -   Added the `aux.builders` tag which allows setting a whitelist for AUX Builder.
        -   `aux.whitelist` and `aux.blacklist` still exist and can be used to whitelist/blacklist users across both AUX Builder and AUX Player.
        -   If `aux.builders` is present then only users in the builder list can access AUX Builder.
        -   If `aux.builders` is not present then AUX Builder falls back to checking the whitelist and blacklist.
    -   Added support for `aux.movable=diff`.
        -   This mode acts like `clone` but the cloned file is a diff.
        -   You can control the tags that are applied from the diff by setting the `aux.movable.diffTags` tag.
    -   Added `player.isBuilder()` function for AUX Script.
        -   Determines if the current player is able to load AUX Builder without being denied. For all intents and purposes, this means that their name is in the `aux.builders` list or that there is no `aux.builders` list in the globals file.
    -   Added `player.showInputForTag(file, tag, options)` function for AUX Script.
        -   Shows an input dialog for the given file and tag using the given options.
        -   Options are not required, but when specified the following values can be used:
            -   `type`: The type of input dialog to show.
                -   Supported options are `text` and `color`.
                -   If not specified it will default to `text`.
            -   `subtype`: The specific version of the input type to use.
                -   Supported options are `basic`, `advanced`, and `swatch` for the `color` type.
                -   If not specified it will default to `basic`.
            -   `title`: The text that will be shown as the title of the input box.
            -   `foregroundColor`: The color of the text in the input box.
            -   `backgroundColor`: The color of the background of the input box.
            -   `placeholder`: The placeholder text to use for the input box value.
    -   Added autofill feature to the add tag input box for improved tag adding.
    -   Center camera button is only shown when at a specified distance from the world center.
    -   Placed camera type toggle back inside the menu for both AUX Builder and AUX Player.
    -   Changed hexagon image to include a plus sign to make is match with other 'add item' buttons.
    -   Added ability to remove files from a search, will convert any remaining files into a multiselected format.
    -   Removed bottom left diff brush from builder. Diffs need to be dragged from their file ID in the sheets menu now.
    -   Changed the default placholder in the search bar from `search`, `[empty]`, and `[diff-]` to just be `search / run`.
    -   Edited the `RemoveTags()` function to allow it to use Regular Expressions to search for the tag sections to remove.

## V0.8.1

### Date: 05/29/2019

### Changes:

-   Improvements

    -   Added in the `RemoveTags(files, tagSection)` function to remove any tag on the given files that fall into the specified tag section. So triggering a `RemoveTags(this, "position")` will remove all tags such as `position.x` and `position.random.words` on this file.
    -   Added the `aux.destroyable` tag that prevents files from being destroyed when set to `false`.
    -   Made the globals file not destroyable by default.
    -   Reimplemented ability to click File ID in the sheet to focus the camera on it.
    -   Added the `aux.editable` tag that can be used to prevent editing a file in the file sheet.
    -   Added events for `onKeyDown()` and `onKeyUp()`.
        -   These are triggered whenever a key is pressed or released.
        -   The `that` parameter is an object containing the following fields:
            -   `keys` The list of keys that were pressed/released at the same time.
        -   See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values for a list of possible key values.
    -   Added new formula functions:
        -   `getFilesInStack(file, context)` gets the list of files that are in the same position as the given file.
        -   `getNeighboringFiles(file, context, direction)` gets the list of files that are next to the given file in the given direction.
            -   Possible directions: `left`, `right`, `front`, `back`.
            -   If a direction is not specified, then the function returns an object containing every possible direction and the corresponding list of files.
        -   `player.importAUX(url)` loads an .aux file from the given URL and imports it into the current channel.
    -   Improved the `whisper()` function to support giving it an array of files to whisper to.
    -   Set an empty diff file as the selected file if no other files are selected, this will allow new files to be dragged out drom this diff's id as a new file.
        -   Selection count is set to 0 in this instance as not files are meant to be shown as selected.
    -   Added a "Create Worksurface" button to the file sheet.
        -   This will create a new worksurface and place all the selected files on it.
        -   The worksurface will use the given context name and can be locked from access in AUX Player.
        -   The new worksurface file will automatically be selected.
        -   The system will find an empty spot to place the new worksurface.
    -   Added camera center and camera type buttons to lower right corner of AUX Builder and AUX Player.
        -   Inventory in AUX Player also has a camera center button.
        -   Camera center will tween the camera back to looking at the world origin (0,0,0).
        -   Camera type will toggle between perspective and orthographic cameras. The toggle button that used to do this has been removed from the main menus.

-   Bug Fixes
    -   Fixed `tweenTo` function not working after changing the camera type.
    -   Fixed the file sheet to not have a double scroll bar when the tags list becomes longer than the max height of the sheet.
    -   Fixed an issue that would add a file to the "null" context when dragging it out by it's ID.

## V0.8.0

### Date: 05/25/2019

### Changes:

-   Improvements
    -   Replaced 2D slot-based inventory with a full 3D inventory context view on the lower portion of the screen.
        -   You can drag files seamlessly in and out of the inventory and current player context.
        -   Inventory has seperate camera control from the player context.
        -   Inventory is now unlimited in capacity as it is just another 3d context to place files in and take with you.
    -   Added a tag section check for multiple action tags, will now compress them into the `actions()` section.
    -   Add a docker-compose file for arm32 devices.
    -   Add the ability to execute a formula and get file events out of it.
    -   Add a play button to the search bar that executes the script.
-   Bug Fixes
    -   Fixed ability to click on files with `aux.shape` set to `sprite`.
    -   Hide the context menu on mobile when clicking the background with it open.
    -   Refactored progress bars to be more performant.
    -   Progress bars no longer interfere with input.
    -   Allow queries to return values that are not null or empty strings.
    -   Remove context menu on mobile when clicking on background.
    -   Make users that are in AUX Player appear blue.

## V0.7.8

### Date: 05/23/2019

### Changes:

-   Bug Fixes
    -   Made adding a tag put the new tag in the correct position in the sheet so it doesn't jump when you edit it.
    -   Fixed the ability to see other players.

## V0.7.7

### Date: 05/23/2019

### Changes:

-   Improvements
    -   The show hidden tag button and new tag button have swapped places.
    -   The sheets section will automatically appear when the search bar is changed.
    -   New create new file button art has been implemented.
    -   Several tags have changed:
        -   `aux.context.movable` -> `aux.context.surface.movable`
        -   `aux.context.x` -> `aux.context.surface.x`
        -   `aux.context.y` -> `aux.context.surface.y`
        -   `aux.context.z` -> `aux.context.surface.z`
        -   `aux.context.grid` -> `aux.context.surface.grid`
        -   `aux.context.scale` -> `aux.context.surface.scale`
        -   `aux.context.minimized` -> `aux.context.surface.minimized`
    -   Added `aux.context.surface` as a way to determine if a surface should show up in AUX Builder.
        -   Defaults to `false`.
    -   Changed how contexts are configured:
        -   You can now configure a context by setting `aux.context` to the context.
        -   Previously, this was done by creating a special tag `{context}.config`.
    -   Added `aux.context.locked` as a way to determine if a context should be able to be loaded in AUX Player.
        -   Defaults to `true` for contexts that do not have a file that sets `aux.context` for it.
        -   Defaults to `false` for contexts that have a file that sets `aux.context` for it and do not have a `aux.context.locked` tag.
    -   Changed how the globals file is created:
        -   It no longer has a label.
        -   It is now movable by default. (but you have to put it in a context first)
        -   It now defines the "global" context instead of a random context.
        -   It is not in the "global" context by default. (so there's just a surface with no files)
-   Bug Fixes
    -   The tags in sheets will now be sorted aplhabetically on show/hide tag sections.

## V0.7.6

### Date: 05/21/2019

### Changes:

-   Improvements
    -   Tag compression now happens when there are at least 2 similar starting sections.
    -   Tag sections now begin with or are replaced by `#`.
    -   Tag sections now truncate if they are over 16 characters.
    -   Tag sections now begin all turned on when opening the sheets.
    -   Tag sections now account for hidden tags and only show a tag section button if the amount of visible hidden tags is greater than 2.
    -   Made the channel ID parsing logic follow the same rules we use for the URLs.
    -   Added a toast message that will be shown whenever a file is deleted via the file table or the trash can.
-   Bug Fixes
    -   Fixed the `isBuilder` and `isPlayer` helper variables.

## V0.7.5

### Date: 05/21/2019

### Changes:

-   Improvements
    -   Tag compression to the table for tags with 3 or more similar starting sections(The series of characters before the first period in the tag).
    -   Made switching contexts in AUX Player via `player.goToContext()` fast by not triggering a page reload.
    -   Forced each channel in AUX Player to display the same context as the primary context.
    -   Added in ability to drag a block out of the sheet's ID value.
    -   Added the `diff.create(file, ...tags)` function.
        -   This creates a diff that takes the specified tags from the given file.
        -   Tags can be strings or regex.
        -   The result can be used in `applyDiff()` or in `create()`.
        -   Example:
            -   `diff.create(this, /aux\..+/, 'fun')`
            -   Creates a new diff that copies all the `aux.*` and `fun` tags.
    -   Added the `player.currentContext()` function.
        -   This returns the context that is currently loaded into AUX Player.
    -   Added the `onPlayerContextEnter()` event.
        -   This is triggered whenever AUX Player loads or changes a context.
        -   The `that` variable is an object containing the following properties:
            -   `context` - the context that was loaded.
    -   Added convenience functions for accessing the first and last elements on an array.
        -   `array.first()` will get the first element.
        -   `array.last()` will get the last element.
-   Changes
    -   Changed the @ and # formula expressions to always return a list of values.
        -   The values will always be sorted by the ID of the file that it came from.
            -   For @ expressions this means that the files will be sorted by ID.
            -   For # expressions this means that the values will be sorted by which file they came from.
        -   Because of this change, users should now use the `.first()` function to get the first file returned from a query.
-   Bug Fixes
    -   Fixed the wording when adding and removing channels.

## V0.7.4

### Date: 05/20/2019

### Changes:

-   Improvements
    -   Added the `NODE_PORT` environment variable to determine which port to use for HTTP in production.
-   Bug Fixes
    -   Fixed SocketManager to build the connection url correctly.

## V0.7.3

### Date: 05/20/2019

### Changes:

-   Bug Fixes
    -   Updated sharp to v0.22.1

## V0.7.2

### Date: 05/20/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue where the server would return the wrong HTML page for AUX Player.

## V0.7.1

### Date: 05/20/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue with running AUX on a .local domain that required HTTPs.

## V0.7.0

### Date: 05/20/2019

### Changes:

-   Improvements
    -   Search bar will now always remain across the top of builder.
    -   Made the `aux.context.grid` tag not use objects for hex heights.
    -   Made `auxplayer.com/channel` load AUX Builder and `auxplayer.com/channel/context` load AUX Player.
    -   Added `onConnected()` and `onDisconnected()` events to notify scripts when the user becomes connected for disconnected from the server.
    -   Added `player.isConnected()` to help formulas easily determine if the player is currently connected.
        -   Works by checking the `aux.connected` tag on the user's file.
-   Bug Fixes
    -   Allow for the expansion and shrinking of hexes after they have been raised or lowered.
    -   Clicking on the diff bursh in builder will now make the sheets appear correctly.
    -   Selecting the file ID in builder will now no longer change the zoom that sent the camera too far away.
    -   Upon shrinking the hex grid, hexes will now remain if a file is on top of it.
    -   Clicking on a non centeral hex did not show correct raise and lower options, now it does.
    -   Fixed an issue that would cause a formula to error if evaluating an array which referenced a non-existant tag.
        -   In the test scenario, this made it appear as if some blocks were able to be moved through and other blocks were not.
        -   In reality, the filter was breaking before it was able to evaluate the correct block.
        -   This is why re-creating a file sometimes worked - because the new file might have a lower file ID which would cause it to be evaluated before the broken file was checked.
    -   Fixed an issue that would cause the formula recursion counter to trigger in non-recursive scenarios.

## V0.6.5

### Date: 05/10/2019

-   Improvements
    -   Added `aux.iframe` tag that allows you to embed HTML pages inside an AUX.
        -   Related iframe tags:
            -   `aux.iframe`: URL of the page to embed
            -   `aux.iframe.x`: X local position
            -   `aux.iframe.y`: Y local position
            -   `aux.iframe.z`: Z local position
            -   `aux.iframe.size.x`: Width of the iframe plane geometry
            -   `aux.iframe.size.y`: Height of the iframe plane geometry
            -   `aux.iframe.rotation.x`: X local rotation
            -   `aux.iframe.rotation.y`: Y local rotation
            -   `aux.iframe.rotation.z`: Z local rotation
            -   `aux.iframe.element.width`: The pixel width of the iframe DOM element
            -   `aux.iframe.scale`: The uniform scale of the iframe plane geometry

## V0.6.4

### Date: 05/09/2019

### Changes:

-   Changes
    -   Made cloned files **not** use the creation hierarchy so that deleting the original file causes all child files to be deleted.
-   Bug Fixes
    -   Fixed the "Destroy file" button in the file sheet to allow destroying files while searching.

## V0.6.3

### Date: 05/09/2019

### Changes:

-   Improvements
    -   Made cloned files use the creation hierarchy so that deleting the original file causes all child files to be deleted.
-   Bug Fixes
    -   Fixed an issue that caused clonable files to not be cloned in AUX Player.

## V0.6.2

### Date: 05/09/2019

### Changes:

-   Improvements
    -   Allow users to determine which side of the file they have clicked on by using `that.face` variable on an `onClick` tag.
    -   Removed `aux.pickupable` and replaced it with special values for `aux.movable`.
        -   Setting `aux.movable` to `true` means it can be moved anywhere.
        -   Setting `aux.movable` to `false` means it cannot be moved.
        -   Setting `aux.movable` to `clone` means that dragging it will create a clone that can be placed anywhere.
        -   Setting `aux.movable` to `pickup` means it can be moved into any other context but not moved within the context it is currently in (only applies to AUX Player).
        -   Setting `aux.movable` to `drag` means it can be moved anywhere within the context it is currently in but not moved to another context. (only applies to AUX Player).
    -   Added the ability to destroy files from the file sheet.
    -   Added the ability to display a QR Code from formula actions.
        -   Use `showQRCode(data)` and `hideQRCode()` from formula actions.
    -   Added the ability to create a new empty file from the file sheet.
        -   Doing so will automatically select the new file and kick the user into multi-select mode.
    -   Added the ability to whitelist or blacklist users by using `aux.whitelist` and `aux.blacklist`.
        -   For example, setting `aux.whitelist` to `Kal` will ensure that only users named `Kal` can access the session.
        -   Similarly, setting `aux.blacklist` to `Kal` will ensure that users named `Kal` cannot access the session.
        -   In the case of a name being listed in both, the whitelist wins.
-   Bug Fixes
    -   Fixed an issue where long tapping on a file would register as a click on mobile.
    -   Dragging a minimized workspace will no longer change its z value for depth, only its x and y.

## V0.6.1

### Date: 05/07/2019

### Changes:

-   Bug Fixes
    -   Fixed the Copy/Paste shortcuts to make `Cmd+C` and `Cmd+V` work on Mac.

## V0.6.0

### Date: 05/07/2019

### Changes:

-   Improvements

    -   Added an `aux.progressBar` tag that generates a progressbar above the file, this tag can be set to any value form 0 to 1.
        -   This new tag also has additionally: `aux.progressBar.color` and `aux.progressBar.backgroundColor` to color the progressbar's components.
        -   This tag also has: `aux.progressBar.anchor` to set the facing direction of the progress bar relative to the file.
    -   Added `aux.pickupable` to control whether files can be placed into the inventory in the player or not, will be true (able to be put in inventory) by default.
        -   If `aux.pickupable` is true but `aux.movable` is false, the file can still be dragged into the inventory without moving the file position. It can also be dragged out of the inventory by setting the file position only until is is placed, then not allowing position changes again as `aux.movable` is still false.
    -   Added the ability to load additional channels into an AUX Player channel.
        -   Channels can be loaded from any reachable instance of AUX Server. (auxplayer.com, a boobox, etc.)
        -   To add a channel to your AUX Player, simply open the hamburger menu and click "Add Channel".
            -   Enter in the ID of the channel you want to load.
            -   There are several options:
                -   A URL (`https://auxplayer.com/channel/context`)
                -   A remote context ID (`auxplayer.com/channel/context`)
                -   A local context ID (`channel/context`)
                -   A local channel ID (`channel`)
        -   To remove a channel, open the hamburger menu and click on the one you want to remove.
        -   Channels can also be loaded by putting them in the query string of the URL.
            -   This is done by adding a parameter named `channels` set to the ID of the channel that you want to load.
            -   For example, `channels=abc/test` will load the `abc/test` channel.
            -   As a result, the URL ends up looking something like this `https://auxplayer.com/channel/context?channels=abc/test&channels=other/channel`.
            -   Note that you can only add channels this way. You must go to the hamburger menu to remove a channel.
                -   Sharing URLs will cause all the channels you have loaded to show up for someone else but it won't remove any channels they already have loaded.
        -   Added several new formula functions:
            -   `superShout(event, arg)` performs a shout that goes to every loaded channel. This is the only way for channels to communicate with each other.
            -   `player.loadChannel(id)` loads the channel with the given ID.
            -   `player.unloadChannel(id)` unloads the channel with the given ID.
        -   Additionally, the following events are always sent to every channel:
            -   `onQRCodeScannerOpened()`
            -   `onQRCodeScannerClosed()`
            -   `onQRCodeScanned()`
            -   `onTapCode()`
        -   How it works
            -   Channels are loaded by creating files in the user's "simulation context".
                -   You can get the user's simulation context by using `player.getFile().aux._userSimulationsContext`.
            -   AUX Player looks for these files and checks if they have a `aux.channel` tag.
                -   For files that do, then the `aux.channel` tag value is used as a channel ID and then AUX Player loads it for each file.
                -   Files that don't are ignored.
            -   Note that because we have multiple channels loaded there are multiple user files and global files.
                -   This is fine because channels cannot lookup files that other channels have.
                -   Because of this, a user also has multiple simulation contexts.
                -   This works out though, because we merge all the simulation contexts and remove duplicate channels.
                -   When `player.unloadChannel(id)` is called, we only remove simulation files that are in the channel that the script is running in.
                -   As a result, if another channel has called `player.loadChannel(id)` with the same ID the channel will remain loaded because at least one channel has requested that it be loaded.
    -   Added in a tween for the zoom that fires once a file has been focused on, it will tween to file position then zoom to the set zoom value.
    -   Added `whisper(file, event, argument)` formula function that sends shouts to a single file.
    -   Added a `aux.version` tag to the globals file which will be used to help determine when breaking changes in the AUX file format occur.
    -   Added the ability to copy and paste file selections in AUX Builder.
        -   Pressing `Ctrl+C` or `Cmd+C` will cause the currently selected files to be copied to the user's clipboard.
        -   Pressing `Ctrl+V` or `Cmd+V` will cause the currently selected files to be pasted into the world where the user's cursor is.
        -   Does not interfere with normal copy/paste operations like copying/pasting in input boxes.
        -   If a worksurface is included in the user's selection the new worksurface will be duplicated from it.
            -   This allows you to do things like copy the context color.
            -   Any files that are being copied from the old worksurface to the new one will also maintain their positions.
    -   Added the ability to copy worksurfaces AUX Builder using the new `"Copy"` option in the context menu.
        -   Using the `Ctrl+V` keybinding after copying the worksurface will paste a duplicate worksurface with duplicates of all the files that were on the surface.
    -   Added the ability to drag `.aux` files into AUX Builder.
        -   This will upload them just like the upload option in the hamburger menu.
    -   Added `player.hasFileInInventory(file)` formula function that determines if the given file or list of files are in the current player's inventory.
        -   As a part of this change, it is now possible to use the other user-related functions in formulas.
    -   Moved the `handlePointerEnter` and `handlePointerExit` function logic to only work in `PlayerInteractionManager`.
    -   Added the `handlePointerDown` to `PlayerInteractionManager` so down events in general can be collected on the player.
    -   Clicking on the `Raise` and `Lower` options on the workspace dropdown will now effect the entrire workspace if it has been expanded.

## V0.5.4

### Date: 04/29/2019

### Changes:

-   Improvements
    -   Changed AUX Player's default background color to match the dark background color that AUX Builder uses.
    -   Changed the globals file to look like a normal file when created and be labeled as "Global".
    -   Updated all the formula functions to use the new naming scheme.
    -   Added the ability to drag worksurfaces when they are minimized.
        -   Setting `aux.context.movable` to `false` will prevent this behavior.
    -   Selecting an item in the inventory no longer shows a selection indicator.
-   Bug Fixes
    -   The inventory placeholders should now always appear square.
    -   Dragging an item out of the inventory will now always remove the image of that item in the inventory.

## V0.5.3

### Date: 04/26/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue that would cause data loss on the server.
        -   The issue was caused by not cleaning up some resources completely.
        -   Because some services were left running, they would allow a session to run indefinitely while the server was running but were not saving any new data to the database.
        -   As a result, any changes that happened after the "cleanup" would be lost after a server restart.

## V0.5.2

### Date: 04/26/2019

### Changes:

-   Improvements
    -   Set builder's default background color to dark gray. Player remains the light blue.
    -   Changed the `onDragAny/onDropAny` actions to be `onAnyDrag/onAnyDrop`.
    -   `formula-lib.ts` has changed `isPlayerInContext` export to `player.isInContext`.
    -   `formula-lib.ts` has changed `makeDiff` export to `diff`.
    -   Made the mini file dots much smaller.
    -   Added the ability to show and hide a QR Code Scanner using the `openQRCodeScanner()` and `closeQRCodeScanner()` functions.
        -   Upon scanning a QR Code the `onQRCodeScanned()` event is triggered with the `that` variable bound to the scanned QR code.
        -   The `onQRCodeScannerOpened()` event is triggered whenever the QR Code Scanner is opened.
        -   The `onQRCodeScannerClosed()` event is triggered whenever the QR Code Scanner is closed.
    -   Moved the file sheet to the right side of the screen.
-   Bug Fixes
    -   Fixed an issue with trying to load a WebP version of the "add tag" icon in Safari.
        -   Safari doesn't support WebP - so we instead have to load it as a PNG.
    -   Fixed the proxy to return the original content type of images to Safari.
        -   Because Safari doesn't support WebP we can't automatically optimize the images.

## V0.5.1

### Date: 04/25/2019

### Changes:

-   Improvements
    -   Automatically log in the user as a guest if they attempt to got to as context without being logged in.
-   Bug Fixes
    -   Stopped a new Guest's username from saying `guest_###` upon logging into a new guest account for the first time.
    -   Fixed highlighting issues when dragging files around.
    -   Totally removed the AUX Player toolbar so that it doesn't get in the way of input events. (Was previously just transparent)
    -   Fixed an issue with files not responding to height changes on a hex when the config file wasn't in the same context.

## V0.5.0

### Date: 04/25/2019

### Changes:

-   Improvements
    -   Restricted onCombine feature to only fire in aux-player and restrict it from happening on aux-builder.
    -   Removed the `clone()` function.
    -   Improved the `create()` function to be able to accept lists of diffs/files.
        -   This allows you to quickly create every combination of a set of diffs.
        -   For example, `create(this, [ { hello: true }, { hello: false } ])` will create two files. One with `#hello: true` and one with `#hello: false`.
        -   More complicated scenarios can be created as well:
            -   `create(this, [ { row: 1 }, { row: 2 } ], [ { column: 1 }, { column: 2 } ])` will create four files for every possible combination between `row: 1|2` and `column: 1|2`.
            -   `create(this, { 'aux.color': 'red' }, [ makeDiff.addToContext('context_1'), makeDiff.addToContext('context_2') ])` will create two files that are both red but are on different contexts.
            -   `create(this, @aux.color('red'), { 'aux.color': 'green' })` will find every file that is red, duplicate them, and set the new files' colors to green.
    -   Improved how we position files to prevent two files from appearing at the same index.
        -   Creating new files at the same position will now automatically stack them.
        -   Stacking is determined first by the index and second by the file ID.
    -   Added a zoom property to the `tweenPlayerTo` function to set a consistent zoom on file focus.
    -   Moved the worksurface context menu options to files mode.
    -   Moved the channel name to the hamburger menu and added the QR Code to the menu as well.
    -   Worksurface improvements
        -   Removed the header in AUX Player so that only the hamburger menu is shown.
        -   Removed the option to enter into worksurfaces mode.
            -   If users are already in worksurfaces mode then they can still exit.
        -   Removed the ability to snap or drag worksurfaces.
        -   Removed the ability to change the worksurface color.
    -   Removed the change background color context menu.
    -   Made the globals file generate as a worksurface.
    -   File Sheet/Search improvements
        -   Removed the edit icon and replaced it with a search icon at the top right of the top bar.
        -   Added the ability to save a `.aux` file from the current selection/search.
        -   Moved the "+tag" button to the left side of the panel and added an icon for it.
        -   Added another "Add Tag" button to the bottom of the tags list.
        -   Added the ability to show the list of selected file IDs in the search bar.
-   Bug Fixes
    -   Stopped sheet closing bug from taking multiple clicks to reopen.

## V0.4.15

### Date: 04/22/2019

### Changes:

-   Improvements

    -   Added a basic proxy to the server so that external web requests can be cached for offline use.
        -   Only works when the app is served over HTTPS.
        -   Uses service workers to redirect external requests to the server which can then download and cache the resources.
            -   Shouldn't be a security/privacy issue because all cookies and headers are stripped from the client requests.
            -   As a result this prevents users from adding resources which require the use of cookies for authorization.
            -   A nice side-effect is that it also helps prevent advertisers/publishers from tracking users that are using AUX. (Cookie tracking and Browser Fingerprinting are prevented)
        -   Currently, only the following image types are cached:
            -   `PNG`
            -   `JPG`
            -   `GIF`
            -   `WEBP`
            -   `BMP`
            -   `TIFF`
            -   `ICO`
        -   Upon caching an image, we also optimize it to WEBP format to reduce file size while preserving quality.
    -   Added `onPointerEnter()` and `onPointerExit()` events that are triggered on files that the user's cursor hovers.
    -   Added a pre-commit task to automatically format files.
    -   Formatted all of the source files. (TS, JS, Vue, JSON, HTML, CSS)
    -   Added an option to the dropdown in aux-builder to jump to aux-player for the current context
    -   `formula-lib.ts` has added a `isPlayerInContext` function to determine if path is in the expected context in aux-player.
    -   `formula-lib.ts` has changed `tweenTo` function to `tweenPlayerTo` for better clarity on the function's use.

## V0.4.14

### Date: 04/19/2019

### Changes:

-   Improvements
    -   Users that join as a guest will now have a cleaner visible name of `Guest`.
    -   Removed the builder checkbox on the new workspace popup to make the feature cleaner.
    -   Added the ability to zoom to a file by tapping/clicking its ID in the file sheet.
    -   Added a couple script functions:
        -   `tweenTo(file or id)` causes the current user's camera to tween to the given file. (just like how the sheet does it)
        -   `toast(message)` causes a toast message to pop up with the given message. It will automatically go away after some time.

## V0.4.13

### Date: 04/18/2019

### Changes:

-   Improvements
    -   Can load external images by setting `aux.image` to an image url.
        -   **NOTE:** The remote server must be CORS enabled in order to allow retrieval of the image.
    -   Added `sprite` as an option for `aux.shape`.
        -   This is a camera facing quad that is great for displaying transparent images.
    -   Added several events:
        -   `onCreate()` is called on the file that was created after being created.
        -   `onDestroy()` is called on the file just before it is destroyed.
        -   `onDropInContext()` is called on all the files that a user just dragged onto a context. (`that` is the context name)
        -   `onDragOutOfContext()` is called on all the files that a user just dragged out of a context. (`that` is the context name)
        -   `onDropAnyInContext()` is called on all files when any file is dragged onto a context. (`that` is an object that contains the `context` and `files`)
        -   `onDragAnyOutOfContext()` is called on all files when any file is dragged out of a context. (`that` is an object that contains the `context` and `files`)
        -   `onDropInInventory()` is called on the file that a user just dragged into their inventory.
        -   `onDragOutOfInventory()` is called on the file that a user just dragged out of their inventory.
        -   `onDropAnyInInventory()` is called on all files when any file is dragged into the user's inventory. (`that` is the list of files)
        -   `onDragAnyOutOfInventory()` is called on all files when any file is dragged out of the user's inventory. (`that` is the list of files)
        -   `onTapCode()` is called on every file whenever a 4 digit tap code has been entered. (`that` is the code)
            -   It is recommended to use an `if` statement to filter the tap code.
            -   This way you won't get events for tap code `1111` all the time due to the user tapping the screen.
        -   All of the drag/drop events are triggered once the user is done dragging. (not during their drag)
    -   Added checkboxes the new workspace modal to allow users to set whether it should show up in builder, player, or both.

## V0.4.12

### Date: 04/17/2019

### Changes:

-   **Breaking Changes**
    -   Changed worksurfaces and player config files to use `{context}.config` instead of `aux.builder.context` and `aux.player.context`.
        -   This also allows people to specify formulas on a per-context basis.
        -   We call these new tags "config tags".
        -   For example, you can show the `hello` context in both AUX Builder and AUX Player by setting the `hello.config` tag to `true`.
        -   Because of this change, existing worksurfaces no longer work. To regain your worksurfaces, do a search for `@aux.builder.context` and then create a config tag for the worksurfaces that are found.
    -   Changed worksurface config values to use `aux.context.{value}` instead of `aux.builder.context.{value}`.
        -   Removing `builder` from the name makes it easier to understand that the tags are describing the contexts that the file is configuring.
    -   Renamed `aux._parent` to `aux._creator`.
    -   Moved functions that create file diffs to their own namespace.
        -   `xyzDiff()` is now `makeDiff.xyz()`
        -   so `addToContextDiff()` is now `makeDiff.addToContext()`
-   Bug Fixes
    -   Fixed an issue that would prevent some files from showing up in Aux Builder due to being created with incorrect data.
    -   Fixed the ability to shrink worksurfaces.
-   Improvements
    -   Added the ability to pass arguments in `shout()`.
        -   For example, you can pass the number 11 to everything that has a `handleMessage()` tag using `shout("handleMessage", 11)`.
    -   Added `isBuilder` and `isPlayer` variables to formulas.
        -   This allows formulas to tell whether they are being run in AUX Builder or AUX Player.
        -   Using these variables in combination with config tags allows specifying whether a context should show up in AUX Builder or AUX Player.
        -   For example, the `hello` context will only show up in AUX Builder when the `hello.config` tag is set to `=isBuilder`.
    -   Added the ability to pass an array of files to `clone()` and `destroy()`.
    -   Changed the generated context ID format from `aux._context_{uuid}` to `context_{short-uuid}`.
    -   Added `aux.mergeable` so control whether diffs can be merged into other files.
    -   Added `md-dialog-prompt` to `GameView` to allow users to set custom contexts for new workspaces.
    -   Removed the `_destroyed` tag. Setting it now does nothing.
    -   Aux Player now uses `aux.context.color` value as the scene's background color.
        -   If `aux.context.color` has no value or is undefined, then it will fall back to `aux.scene.color`.
    -   Made diff toolbar in AUX Builder transparent and Inventory toolbar in AUX Player mostly transparent (slots are still lightly visible.)
    -   Added a trash can that shows up when dragging a file.
        -   Dragging files onto this trash can causes the file to be deleted.
        -   Dragging a diff onto the trash can causes the diff to be cleared.
    -   Added support for `aux.label.anchor` to allow positioning of the label.
        -   Supported values are:
            -   top (default)
            -   left
            -   right
            -   front
            -   back
            -   floating (word bubble)

## V0.4.11

### Date: 04/12/2019

### Changes:

-   Improvements
    -   Updated mesh materials and scene lighting to provide a cleaner look and more accurate color representation.
    -   Dragging files off of worksurfaces no longer deletes them but simply removes them from the context.
    -   Functions:
        -   The `clone()` and `copy()` functions have been changed to accept the first parameter as the creator. This means instead of `clone(this)` you would do `clone(null, this)`. Because of this change, `cloneFrom()` and `copyFrom()` are redundant and have been removed.
        -   The `clone()` and `copy()` functions now return the file that was created.
        -   New Functions:
            -   `addToContextDiff(context, x (optional), y (optional), index (optional))` returns an object that can be used with `create()`, `clone()`, or `applyDiff()` to create or add a file to the given context.
            -   `removeFromContextDiff(context)` returns an object that can be used with `create()`, `clone()`, or `applyDiff()` to remove a file from the given context.
            -   `addToContext(file, context)` adds the given file to the given context.
            -   `removeFromContext(file, context)` removes the given file from the given context.
            -   `setPositionDiff(context, x (optional), y (optional), index (optional))` returns a diff that sets the position of a file in the given context.
            -   `addToMenuDiff()` returns a diff that adds a file to the user's menu.
            -   `removeFromMenuDiff()` returns a diff that removes a file from the user's menu.
        -   Other changes
            -   `create()`, `clone()`, and `createMenuItem()` all support using files as diffs.

## V0.4.10

### Date: 04/11/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue that prevented shouts from adding menu items to the user's menu.
    -   Fixed an issue that caused all users to have hexes.

## V0.4.9

### Date: 04/11/2019

### Changes:

-   Bug Fixes
    -   Fixed a build error.
-   Other improvements
    -   Fudging orthographic camera user context position based on its zoom level. This is not a perfect implementation but does provide a better sense of “where” ortho are when using zoom.

## V0.4.8

### Date: 04/11/2019

### Changes:

-   Bug Fixes
    -   Fixed some broken tests.

## V0.4.7

### Date: 04/11/2019

### Changes:

-   Bug fixes
    -   Typing `=` into a cell should no longer cause issues.
-   Improvements
    -   Menus
        -   Files can now be added to the user's menu.
        -   The items will only show up in AUX Player.
        -   Several functions have been added to help with adding and creating menu items:
            -   `createMenuItem(category, label, actionScript, data (optional))` will create a new file and add it to the current user's menu.
            -   `destroyMenuItem(category)` will destroy any files in the current user's menu with the given category.
            -   `destroyAllMenuItems()` will destroy all files in the current user's menu.
            -   `addToMenu(file)` will add the given file to the current user's menu.
            -   `removeFromMenu(file)` will remove the given file from the current user's menu.
        -   In addition, the following tags control various properties on menu items.
            -   `aux.label` controls the text on the menu item.
            -   `aux.label.color` controls the text color of the menu item.
            -   `aux.color` controls the background color of the menu item.
            -   `onClick()` is called when the menu item is clicked.
            -   `aux.input` turns the menu item into an input that allows modification of the given tag name.
                -   Clicking on the menu item will show a dialog with an input box.
            -   `aux.input.target` indicates the file that the input tag should be set on.
                -   for example, setting `aux.input.target` to `=@name("joe")` will cause the input to change the tag on the file that has the `name` tag set to `joe`.
            -   `aux.input.placeholder` sets the placeholder text to use for the input box.
            -   `onSave()` is called after the user chooses to save their changes.
            -   `onClose()` is called after the dialog has been closed, regardless of whether the changes were saved or not.

## V0.4.6

### Date: 04/11/2019

### Changes:

-   Improvements

    -   Camera is now orthographic by default for both AUX Builder and AUX Player.
        -   There is a toggle button in the menu for builder and player that lets you toggle a perspective camera on/off.

## V0.4.5

### Date: 04/10/2019

### Changes:

-   Bug Fixes
    -   Fixed scrolling in the file panel.

## V0.4.4

### Date: 04/10/2019

### Changes:

-   Improvements:
    -   Diffballs
        -   The recent files list is now a "brush" that takes properties from the last file or tag that was modified.
        -   This means that you can now drag out a file on top of another file to paint the brush's tags onto another file.
        -   The effect is that you can copy and paste tags onto other files.
    -   File Selection
        -   The file panel now only shows the number of selected files when in multi-select mode.
        -   When in single select mode the "Unselect All" button is now a "Multi Select" button to transition to multi select mode.
        -   Hiding or showing the file panel no longer changes the file selection mode.
        -   Selecting the file brush at the bottom of the screen now opens the file panel to show the tags on the brush.
        -   When the brush is selected, the "Muti Select" button becomes a "Clear Diff" button which resets the brush to an empty file.

## V0.4.3

### Date: 04/09/2019

### Changes:

-   Improvements:

    -   Loading screen will show error if one occurs during load.
    -   Can close loading screen if error occurs by pressing the `DISMISS` button.

## V0.4.2

### Date: 04/09/2019

### Changes:

-   Added loading screen to Aux Builder and Aux Player.

## V0.4.1

### Date: 4/05/2019

### Changes:

-   Improvements
    -   File Selection
        -   There are now two file selection modes:
        -   Single select
            -   Users in single select mode are able to click files to automatically show the sheet for the selected file.
            -   Clicking in empty space will clear the selection.
            -   Holding control and selecting another file will add the clicked file to the user's selection and switch to multi-select mode.
            -   Closing the sheet or clicking "Unselect All" will cause the user's selection to be cleared.
        -   Multi select
            -   Works like the old way.
            -   Opening the sheet causes multi-select mode to be enabled.
            -   Alternatively, selecting a file while holding the control key will also cause multi-select mode to be enabled.
            -   While in multi select mode the sheet can be closed just like normal.
            -   Clicking "Unselect All" will cause the selection to be cleared and will switch back to single select mode.
    -   File Sheet
        -   Search
            -   The file sheet now includes a search icon that can be used to show a search bar.
            -   The search bar allows the user to type in formulas and see the results in realtime.
            -   Any files returned from the search are editable in the table.
            -   Other results (like numbers) are shown in a list.
            -   Using the `Ctrl+F` (`Cmd` is difficult to intercept) keyboard shortcut will open the sheet and automatically focus the search bar.
            -   Pressing `Enter` or the green checkmark next to the search bar will finish the search and automatically select any files returned from the search.

## V0.4.0

### Date: 4/04/2019

### Changes:

-   Bug Fixes:
    -   Fixed an issue with having multiple tabs open that caused the tabs to send events as each other.
        -   This was previously fixed but was re-broken as part of a bit of rework around storing atoms.
        -   The issue is that storage is shared between tabs so we need to make sure we're storing the data separately per tab.
        -   So the signatures were valid because they were sharing the same keys.
        -   Maybe something like a copy-on-write mechanism or splitting trees based on the site IDs could fix this in a way that preserves offline capabilities.
        -   Upon reload we would check local storage for currently used site IDs and pick one of the local site IDs that is not in use.
    -   Fixed an issue with scaling and user positions. The user positions were not being scaled to match the context that they were in.
    -   Made the server clear and re-create trees that get corrupted after a reload.
        -   This is a dangerous operation, we'll need to spend some dev time coming up with an acceptible solution to corrupted trees so that data doesn't get lost.
        -   Basically the issue is that we currently don't have a way to communicate these issues to users and make informed decisions on it.
        -   Also because of the issue with multiple tabs, we're always trying to load the tree from the server so we can't have the client send its state to recover.
        -   So, in the meantime, this is potentially an acceptible tradeoff to prevent people from getting locked out of simulations.
-   Other improvements

    -   Redirects
        -   Added the ability to redirect to `https://auxplayer.com` when accessing a context in a simulation.
        -   Added the ability to redirect to `https://auxbuilder.com` when accessing a simulation without a context.
    -   Dynamic client configuration
        -   The client now requests a configuration from the server on startup.
        -   This lets us handle some configuration tasks for the client at runtime from the server.
        -   Will be useful for managing URLs and other functionality for deployments to Raspberry PIs.
    -   Multi-line Editor
        -   Added the ability to show a multi-line text editor for tag values.
        -   This makes editing things like actions and formulas much easier.
    -   File Sheet Axis
        -   Improved the File Sheet to use CSS Grids instead of table elements.
        -   This gives us the capability to dynamically switch between row and column modes.
        -   Also gives us more control over sizing of elements and responsiveness.
    -   Inventory bar adjusts to mobile screen resolutions.
    -   Users are now represented as a semi-transparent square cone mesh.
    -   Scripting Improvements
        -   Added the ability to set tag values on files that are returned from `@` queries.
            -   For example, `@name('bob').name = 'joe'` changes the name of `bob` to `joe`.
            -   Caveats:
                -   Setting individual array values is not supported.
                -   So doing `this.colors[1] = 'blue'` would not change the second element of the `colors` tag to `blue`.
        -   Added the `aux._parent` tag that contains the ID of the file that a file is childed to.
        -   When `destroy(file)` is called all files that have `aux._parent` matching `file.id` will also be destroyed. This happens recursively.
        -   Added a new function `cloneFrom(file, ...newData)`.
            -   Similar to `clone(file, ...newData)` but sets `aux._parent` on the new file to `file.id`.
            -   The new file will have tags copied from `file` and the given list of objects.
        -   Added a new function `createFrom(file, data)`.
            -   Similar to `create(data)` but sets `aux._parent` on the new file to `file.id`.
            -   The new file will have tags from the given `data` parameter.

## V0.3.26

### Date: 4/01/2019

### Changes:

-   Bug Fixes
    -   Fixed worksurfaces to update when their `aux.builder.context` tag is updated.
-   Other improvements
    -   Improved the server to cleanup trees from memory that aren't in active memory.

## V0.3.25

### Date: 4/01/2019

### Changes:

-   Bug Fixes
    -   Fixed HTML Element targets not being captured as intended when using touch.
        -   This fixes inventory dragging for mobile.
    -   Fixed the ability to use indexer expressions in filters after @ or # queries.
        -   `=@nums()[0]` gets the first file with the `nums` tag on it.
    -   Fixed the ability to call functions in filters after @ or # queries.
        -   `=#nums().map(num => num + 10)` now works and produces a list of numbers where each number has 10 added to it.
    -   Fixed the ability to upload AUX files.
    -   Improved garbage collection so that it avoids expensive operations when there is nothing to remove.
    -   Fixed offline mode to work offline(!).
-   Other improvements
    -   Formulas now support using dots after @ or # queries. For example `=@name('bob').name` now works.
    -   Debug Page
    -   The debug page for AUX Builder has been moved to be after the simulation ID. So to access the debug page for `test` you would go to `https://auxbuilder.com/test/aux-debug`.
    -   The debug page now has a search bar that allows entering a formula to search through the file state.
    -   Added the ability for the debug page to search through destroyed files.
    -   Atom signatures are now only checked when adding individual atoms. This greatly improves loading performance.
    -   Refactored some of the logic around propagating file updates so that they can be more performant in the future.
    -   Destroying files by dragging them off of a worksurface or using the `destroy()` function in an action now uses the causal tree instead of setting the `_destroyed` tag to `true`. (Allows better garbage collection in the future)
    -   Improved first load performance by reducing the amount of work the browser needs to do to store a tree in IndexedDB.
    -   Improved performance for inserting atoms into the weave.

## V0.3.24

### Date: 3/28/2019

### Changes:

-   Features:
    -   Can drag files to and from user's inventory in AUX Player.
    -   Added support for cryptograhpically signing and verifiying events.
    -   Renamed `scale.x`, `scale.y`, and `scale.z` to `aux.scale.x`, `aux.scale.y`, and `aux.scale.z`.
    -   Added the ability to use `aux.scale` to uniformly scale the file.
-   Bug Fixes
    -   Use context.z position has an offset from the calculated display z position in Aux Builder.
        -   Making context.z act as an offset allows context.z value of 0 to place the file on the “ground” regardless of tile height in Aux Builder and always place the file on the ground in Aux Builder.
        -   No more file clipping issues due to grid planes being at different heights between Aux Builder and Aux Player.
    -   Don't clear out tags that end with `.x`, `.y`, or `.z` when dragging new files from the recent files list.
    -   Fixed an issue with trees that could cause sibling atoms to be ignored or ordered improperly.
-   Other Improvements
    -   Builder context file now defaults to flat, clear, and not movable.

## V0.3.23

### Date: 3/26/2019

### Changes:

-   Features
    -   Can drag and combine files in AUX Player.
-   Buf Fixes

    -   Can snap hexes together again as long as there is no file on it (currently this includes the builder context file as well).
    -   Fixed an issue that allowed files representing worksurfaces to be dragged even if `aux.movable` was set to `false`.
    -   Fixed an issue that allowed files to be stacked on top of invisible files that were representing users.

## V0.3.22

### Date: 3/26/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue where atoms could be placed in the wrong spot.
    -   Fixed an issue with importing atoms where the tree could become invalid.
-   Other Improvements
    -   Added some core functionality for the infinite mathematical grid in AUX Player.

## V0.3.21

### Date: 3/24/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue where the server would start handing out old site IDs after a restart.
    -   Added the ability to reject events that become corrupted while in transit.

## V0.3.20

### Date: 3/23/2019

### Changes:

-   Bug Fixes
    -   Fixed another scenario where duplicate atoms could be added to a weave.

## V0.3.19

### Date: 3/23/2019

### Changes:

-   Bug Fixes
    -   Fixed Weaves to prevent duplicate atoms from being added in specific scenarios.
        -   This would cause peers to reject changes from each other.
        -   If the issue happened on the server then every client would reject data from the server until the server was restarted.
        -   The restart would cause the server to reload the atoms from the database, eliminating any duplicates.
    -   Fixed signing out and signing back in on AUX Player to put the user back in the context they were previously in.
    -   Fixed an issue that caused users to be invisible the first time they signed into an AUX Player context.

## V0.3.18

### Date: 3/23/2019

### Changes:

-   Bug Fixes
    -   Fixed so that users can actually log out.
    -   Fixed AR mode in AUX Player.
-   Other Improvements
    -   Added a progress spinner to the login pages.
    -   Added lerping to the user meshes so the position updates look more natural.

## V0.3.17

### Date: 3/22/2019

### Changes:

-   Bug Fixes
    -   Fixed so that updates are only sent every 1/2 second instead of up to every frame.

## V0.3.16

### Date: 3/22/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue that would cause two browser tabs to go to war over which was the real tab for that user.
    -   Fixed an issue that would cause two browser tabs to potentially become inconsistent with each other because they were sharing the same site ID.
-   Other Changes
    -   Added a couple extra logs to MongoDBTreeStore.
    -   Added additional safegards against invalid events.

## V0.3.15

### Date: 3/22/2019

### Changes:

-   Bug Fixes
    -   Fixed an issue that prevented users from creating new simulations.
    -   Fixed an issue that caused duplicate files to be created in the game view.
    -   Fixed issues with logging in as the same user from different devices.
    -   Fixed an issue that would cause newly created trees to have garbage collection disabled.
-   Other Improvements
    -   Improved word bubble performance.
    -   Improved performance when loading large causal trees.
    -   Added additional validations when importing trees to prevent errors down the road.
    -   Improved the server to add a root atom if loading a tree that has no atoms.

## V0.3.14

### Date: 3/22/2019

### Changes:

-   Bug Fixes
    -   Fixed CausalTreeServer to save imported atoms.
    -   Fixed CausalTreeServer to not re-store atoms each time it loads the tree from the database.
    -   Make CausalTree export version 3 trees.
    -   Make CausalTree collect garbage after importing.
-   Other Changes
    -   Enable some debug logs.

## V0.3.13

### Date: 3/21/2019

### Changes:

-   Bug Fixes
    -   Reduced memory usage of worksurfaces. This makes it easier to create large worksurfaces.
    -   Fixed not being able to drag the camera around when tapping/clicking on a worksurface while in files mode.
    -   Added indexes to MongoDB collections so that queries won't be so slow.

## V0.3.12

### Date: 3/21/2019

### Changes:

-   Bug Fixes
    -   Fixed issues with slowdowns caused by continually re-saving the entire history.
    -   Fixed several performance issues related to labels and word bubbles.
    -   Changed the branding to AUX Builder from File Simulator.
    -   Fixed several issues with files and contexts in AUX Player.
        -   Files marked as `_destroyed` now no longer display.
        -   Fixed a loading order issue that would occur when a file was its own context.
        -   Fixed an issue that would cause the player to ignore the file removed event for the context file.
    -   Fixed Word Bubbles so that they scale with labels when `aux.label.size.mode` is set to `auto`.
-   AUX Player Improvements
    -   Users now show up inside contexts in both AUX Builder and AUX Player.
    -   The `_lastActiveTime` tag is now per-context. (i.e. `context_a._lastActiveTime`)
-   AUX Builder Improvements
    -   Added the ability to fork simulations.
-   Other Improvements
    -   Added the ability to transparently upgrade our storage formats.
        -   Works for both MongoDB and IndexedDB.
    -   Made the server respond to the local IP Addresses by default in Development mode.
        -   This makes it easier to do development with a mobile device.
        -   Use `npm run watch:player` to have it serve the AUX Player by default. Otherwise it will serve the AUX Builder.
    -   Improved formula query expresions to support tags with dots in them.
        -   Before you would have to wrap the tag in a string.
        -   Now you can simply do `@aux.label` or `#aux.label` as long as each part is a valid [JS identifier](https://developer.mozilla.org/en-US/docs/Glossary/Identifier).

## V0.3.11

### Date: 3/19/2019

### Changes:

-   Bug Fixes
    -   Fixed dragging worksurfaces while in files mode.
    -   Fixed an issue in Aux Player that caused a file to still be visible even if it was destroyed.
    -   Fixed a login issue that would cause the user to get stuck in a redirect loop.
    -   Fixed shouts.
    -   Fixed AUX File upload to overwrite existing state instead of trying to merge the two trees.
        -   This allows us to keep better consistency across multiple devices.
    -   Fixed user labels.
-   Formula Improvements
    -   Improved formulas allow using normal dot syntax for tags with dots in them.
        -   This means you can now do `this.aux.color` instead of `this['aux.color']`
        -   As a result of this change, primitive values (number, string, boolean) are converted to objects.
        -   So to do equality comparisions you must use the `==` operator instead of either `!` or `===`.
        -   Numerical operators and other comparision operators still work fine.
        -   You can alternatively use the `valueOf()` function to convert the object back into a primitive value.
    -   Added the ability to change a file value simply by changing it.
        -   This means instead of doing `copy(this, { "aux.color": "red" })` you can now do `this.aux.color = "red"`.
        -   Additionally, we no longer destroy files by default.
        -   This means that the destroy/recreate pattern is basically deprecated. This pattern worked in simple scenarios, but for more complex scenarios it could easily cause race conditions where duplicate files are created because users clicked the same file at the same time.
-   Other Improvements
    -   Improved the `goToContext()` formula function to be able to accept a single parameter that indicates the context to go to.
        -   The function will infer the current simulation ID from the URL.

## V0.3.10

### Date: 3/18/2019

### Changes:

-   Fixed aux upload.

## V0.3.9

### Date: 3/18/2019

### Changes:

-   Fixed Aux Player file added event ordering.
-   Reworked actions function to take an arbitrary number of files.
-   Added ability to have tag filters that match everything.
-   Added `shout` formula function.
    ```
    shout(eventName)
    ```
-   Added `goToContext` formula function.
    ```
    goToContext(simulationId, contextId)
    ```
-   Calling `onClick` action on file that gets clicked by the user in Aux Player.
-   Fixed Aux Player showing destroyed files.

## V0.3.8

### Date: 3/18/2019

### Changes:

-   Changed configurations to allow auxplayer.com and auxbuilder.com

## V0.3.7

### Date: 3/17/2019

### Changes:

-   Added InventoryContext to hold onto user’s inventory data much in the same way Context3D does (WIP). Ported over some MiniFile stuff from Aux Projector to get inventory display framework up (WIP).
-   Renamed pointOnGrid to pointOnWorkspaceGrid for clarification.

## V0.3.6

### Date: 3/15/2019

### Changes:

-   Changed to using Causal Trees for history.
    -   **This is a breaking change**
    -   This gives us the ability to support offline mode and keep action history.
    -   Because of how the system is designed, every merge conflict can be resolved in a reasonable manner.
    -   This is a new storage format, so data needs to be migrated.
    -   This is also fairly new, so it may have some weird bugs.
-   Removed file types.
    -   **This is a breaking change**
    -   This allows any file to visualize any grouping of files. (e.g. look like a worksurface)
    -   As a result, the only difference between a file and a worksurface is what tags the file has.
    -   This means that new worksurfaces will have a file on them by default. This file is the data for the worksurface.
    -   To create a workspace:
        -   Make a file that has `builder.context` set to any value.
        -   This value is the context that the file is visualizing.
        -   _To make other files show up in this context you simply create a tag with the same name as the context as set its value to `true`._
        -   **Note that when you create a worksurface in worksurface mode we do this for you automatically.**
    -   A couple tags were changed:
        -   `_position`
            -   Split into 3 different tags. (x, y, z)
            -   To change the position of a file you use `{context}.x`, `{context}.y`, and `{context}.z` as the tag names.
        -   `_workspace`
            -   Now to place a file on a workspace you set the `{context}` tag to `true`
        -   All existing tags have been moved to the `aux` namespace.
            -   This affects `color`, `scale`, `stroke`, `line`, `label`, `movable`, and `stackable`.
            -   They have been changed to `aux.color`, `aux.scale`, `aux.stroke`, `aux.line`, `aux.label`, `aux.movable`, and `aux.stackable`.
        -   `_hidden`
            -   This option has been removed in favor of setting the `aux.color` tag to `transparent` or `clear`.
            -   To remove the lines you simply need to set the `stroke.color` tag to `transparent`/`clear`.
    -   Several new tags were added:
        -   `builder.context`
            -   Setting this to a value will cause the file to visualize the context that was specified.
            -   This means appearing like a worksurface and showing any files that have the related `{context}` tag set to `true`.
        -   `builder.context.x`, `builder.context.y`, `builder.context.z`,
            -   These tags specify the X, Y, and Z positions that the center of the worksurface is placed at.
        -   `builder.context.scale`
            -   This tag specifies the scale of the worksurface. (how big it is)
        -   `builder.context.grid.scale`
            -   This tag specifies the scale of the grid relative to the worksurface. (how big the grid squares are)
        -   `builder.context.defaultHeight`
            -   This tag specifies how tall the hexes on the worksurface are by default.
        -   `builder.context.size`
            -   This tag specifies how many hexes from the center the worksurface contains.
        -   `builder.context.minimized`
            -   This tag specifies whether the worksurface is minimized.
        -   `builder.context.color`
            -   This tag specifies the color that the worksurface is.

## V0.3.5

### Date: 2/26/2019

### Changes:

-   Fixed AR mode.
-   Restoring original background color when exiting AR mode.

## V0.3.4

### Date: 2/25/2019

### Changes:

-   Added stub for AUX Player.
-   Added subdomains for File Simulator (projector.filesimulator.com) and AUX Player (player.filesimulator.com).
-   Lots of file reorganization.
    -   `aux-projector` and `aux-player` are now togethor underneath `aux-web` along with any other common/shared files.
-   Fixed combining.

## V0.3.3

### Date: 2/21/2019

### Changes:

-   Implemented a word bubble to help make file labels more readable.

## V0.3.2

## Data: 2/21/2019

### Changes:

-   Nothing, just trying to get npm flow setup.

## V0.3.1

### Date: 2/20/2019

### Changes:

-   Added the ability to delete files by dragging them off a workspace.
-   Fixed the `destroy()` function in action scripts.

## V0.3.0

### Date: 2/14/2019

### Changes:

-   Added a recursion check to the formula evaluation code to prevent infinite loops from locking up the system.

## V0.2.30

### Date: 2/13/2019

### Changes:

-   Added Aux Debug page that can be reached by prepending `/aux-debug/` to your simulation id in the url.
    -   This page presents the AUX data in its raw JSON form and is updated live when changes arrive from the server.
    -   If you wanted to see the raw data for a simulation called `RyanIsSoCool` you would go to: `filesimulator.com/aux-debug/RyanIsSoCool`.
-   Add the ability to drag a stack of files
    -   For some reason the stack doesn't always move at the same time.
    -   It's some weird issue with not updating them fast enough or something.
-   Debounce updates to the recents list so that we're not forcing re-renders of the mini files all the time
-   Fix so that dragging new files doesn't cause a ton to get created
-   Cause formulas to be run when evaluating filters
    -   This also fixes the issue of numbers and true/false values not matching filters
-   Allow combining files that were just dragged from the file queue
-   Hide files without workspaces

    -   Also log out the file ID when this happens.

## V0.2.29

### Date: 2/13/2019

### Changes:

-   Fixed workspace mesh not updating properly.
-   Remove workspace if size is 0.
    -   Only allow shrinking of a workspace to 0 if there are no files on the workspace.
-   Implemented cleanup of a file's arrows/lines when it is destroyed.

## V0.2.28

### Date: 2/12/2019

### Changes:

-   Make the recent files list use 3D renders of the actual files.
-   Fixed issues with the lines not updating when worksurfaces minimize.
-   Disabled shadows.

## V0.2.27

### Date: 2/11/2019

### Changes:

-   Fix the weirdest bug that was caused by an internal error in Vue.js.
    -   It would do something to stop the touch events from being emitted.
    -   I'm not sure how it did that. Maybe changing focus or something.

## V0.2.26

### Date: 2/11/2019

### Changes:

-   Fixed touch scrolling.
-   Fixed an issue that would prevent immovable files from being dragged off of the recent files list.
-   Fixed an issue that allowed players to place files on minimized worksurfaces.
-   Fixed an issue that allowed minimized worksurfaces to snap together.
-   Made the recents list have 3 files at most.
-   Made files in the recents list not duplicate as long as their normal values are the same.
-   Made selecting a file in the recents list move the selected file to the front.
-   Made the first file in the list larger than the others.
-   Made dragging a file from the recents list not move the dragged file to the front of the list.

## V0.2.25

### Date: 2/11/2019

### Changes:

-   Added the first version of the file toolbar.
    -   This is a list of the user's recently edited files.
    -   Users can select a file from the toolbar to tap and place.
    -   They can also click and drag files out into the world.
-   Made minimized hexes 1/3 the scale of normal hexes.
-   Added the ability to minimize hexes while in file mode.
-   Moved extra buttons like the AR mode to the app sidebar.
-   Made the login email box into a name box.
-   Fixed destroyed blocks not dissapearing.
-   Made the tag input field use a placeholder instead of filling with actual text.
-   Fixed some input issues.

## V0.2.24

### Date: 2/8/2019

### Changes:

-   Scaled down color picker, removed scrolling, and made it slightly wider to accommodate mobile screens.
-   It is now possible to close the Color Picker by tapping on empty space (it will no longer open immediately when tapping of of it).
-   Allow camera dragging when performing click operation on file that is incompatible with the current user mode.
-   Prevent the user from changing the background color when in AR mode.
-   Added the ability to see other people and what they are looking at.
-   Added the ability to minimize worksurfaces.
    -   While minimized they can still be dragged around but changing the size and height is not allowed.
    -   The color can still be changed though.
-   Fixed an issue where everyone would try to initialize the globals file with the default color and get a merge conflict if it was different.

## V0.2.23

### Date: 2/7/2019

### Changes:

-   Made the info box default to closed.
-   Added initial version of WebXR support.
    -   Note that this is Mozilla's old crotchety WebXR and not the official standardized version.
    -   As such, it only works in Mozilla's WebXR Viewer app thing.
    -   Hopefully it doesn't break WebVR support.
-   Changed color picker to swatches style.
-   Can only change scene background color while in workspaces mode.
-   Changed `stroke.linewidth` to be `stroke.width`.

## V0.2.22

### Date: 2/7/2019

### Changes:

-   Color Picker component is now more generic. It invokes a callback function every time the color value changes that you can use to get the color value.
-   Made the QR code larger.
-   Change the scene’s background color by clicking on it and using the color picker.
-   Make basically all the text gray (title bar text, mode switch, add buttons, and the hamburger).
-   Changed color picker type to Compact style.

## V0.2.21

### Date: 2/7/2019

### Changes:

-   Changed the top bar and other buttons to have a white background.
-   Changed the red badge on the pencil to be a neutral gray.
-   Changed the actions icon.
-   Added a grid that is visible in hex edit mode.

## V0.2.20

### Date: 2/7/2019

### Changes:

-   Added color picker component.
-   Can change workspace color using color picker from the context menu.
-   Inverted touch input vertical rotation.
-   Clamping vertical rotation so that you can’t rotate underneath the ground plane.

## V0.2.19

### Date: 2/6/2019

### Changes:

-   Added `stroke.linewidth` to control how thick the stroke lines are.
-   Removed the Skybox.
-   Added the ability to change the vertical tilt of the camera by using two fingers and panning up and down.
-   Reworked the files panel to be easier to use.
    -   Added "+action" button for creating actions.
    -   Moved the "+tag" and "+action" buttons above the file table.
    -   Moved the "Clear selection" button to the header row on the file table.
    -   It still needs some of the scrolling features like not scrolling the header while scrolling the body of the table but for the most part it's done.
    -   Also needs the auto-zoom feature for users. After looking at possible implementations I've discovered that it should be easier to do this when the "seeing other people" update arrives.

## V0.2.18

### Date: 2/5/2019

### Changes:

-   Button polling is now implemented in `InputVR` for vr controllers: `getButtonDown`, `getButtonHeld`, `getButtonUp`.
-   Replaced `GameView.workspacePlane` with mathematical plane for workspace dragging.
    -   This fixes not being able to drag workspaces after we disabled the ground plane mesh.
-   Forcing touch input when being used on a VR capable device in non-VR mode. This fixes traditional browser input on devices like the Oculus Go.

## V0.2.17

### Date: 2/5/2019

### Changes:

-   Moved VR controller code to `InputVR` class.
-   Forcefully disconnecting the controller when exiting VR, this fixes bug with GamePad API when returning to VR mode.
-   Disabled visibility of scene’s ground plane.
-   `ControllerMesh` is now a special `Object3D` that is added to the root controller `Object3D` node.

## V0.2.16

### Date: 2/5/2019

### Changes:

-   Controller is represented as a red pointer arrow. It doesnt not currently allow you to interact yet.
-   Disabling shadows when in VR. Shadows are a significant performance cost in its current state, disabling them gives us 20-30+ fps boost in VR.
-   VR button is now hidden when WebVR is not detected.

## V0.2.15

### Date: 2/5/2019

#### Changes:

-   Changed the default cube color to be white.
-   Changed the default cube outline color to gray instead of invisible.
-   Fixed an issue with action filters where some values weren't able to be matched to a filter.
    -   This happened for some tag values that would be parsed from strings into their semantic equivalents.
    -   For example, `"true"` would get converted to `true` and `"123.456"` would get converted to `123.456`.
    -   This conversion was being ignored for filter values, so they would never match in these scenarios.
-   Fixed an issue with action scripts where copying a file would not copy its formulas.
-   Improved the `copy()` function used in action scripts to be able accept any number of arguments.
    -   This allows cascading scenarios like `copy(this, that, @name("joe"), @name("bob"))`.

## V0.2.14

### Date: 2/4/2019

#### Changes:

-   Added `scale.x`, `scale.y`, and `scale.z` tags to allow changing the scale of the cubes.
    -   `x` and `y` are width and thickness. `z` is height.
-   Dragging worksurfaces now no longer snaps to the center but stays relative to the cursor position.
-   Added `label.size` and `label.size.mode` tags.
    -   `label.size` sets the size of the label. Setting it to 1 means the default size and setting it to 2 means twice the default size.
    -   Setting `label.size.mode` to `"auto"` causes the label to appear a constant size no matter where the user's camera is in the scene.
-   Changed the renderer settings to render the 3D scene at the full device resolution.
    -   This will likely increase the accuracy of rendering results but may also cause performance to drop due to rendering a lot more pixels.
    -   Was previously using the browser-default pixel ratio.
-   Added beta support for Web VR devices.
-   Fixed an issue where worksurfaces that did not have default heights and were merged into other worksurfaces would cause those tiles to incorrectly appear with a height of `0`.
    -   The worksurfaces that did not have default heights were from old versions that did not allow changing heights.
-   Added the number of selected cubes to the info box toggle

## V0.2.13

### Date: 2/1/2019

#### Changes:

-   Camera now handles going from two touch -> one touch without jumping around.
-   Removed time instance in `Time.ts`.
-   Input and Time are both updated manually through `GameView`, we need less `requestAnimationFrame` calls when possible.
-   Fixed bug in `Input` that would cause touches to overwrite old ones on browsers that reuse `TouchEvent` identifiers.
-   Remaining `TouchData` finger indexes get normalized when touches are removed.
    -   i.e. if there are two touches and touch 0 gets removed, then touch 1 becomes touch 0.

## V0.2.12

### Date: 2/1/2019

#### Changes:

-   Added `#stroke.color` which sets an outline on the cube.
-   Added the ability to download `.aux` files.
-   Added the ability to upload `.aux` files into the current session.
-   Changed the URLs to not use `#`. (breaking change!)
-   Changed the home screen to be the root path (`/`) so sessions are now just `filesimulator.com/mysession`. (breaking change!)
-   Changed the login screen to be at `/login`. (So `login` is not a valid session ID anymore) (breaking change!)
-   Fixed an issue where destroyed objects were being returned in action script queries.
-   Fixed an issue that allowed files to be combined with themselves. (Sorry Jeremy!)
-   Fixed an issue where offline users would always overwrite file `_index` values if the index was at `0.`
-   Minor changes:
    -   Add a "continue as guest" button.
    -   Replace "File Simulator" with the session code unless they are in the default session.
    -   Disable auto-capitalization and autocorrect on the input fields.
    -   Change the "Add worksurface" and "Add file" buttons to just be a "+" icon.
    -   Change the mode switch to use icons instead of text for the label.
    -   Make the mode switch always appear white.
    -   Remove color integration from FileValue.
    -   Change "Nuke the site" to something a little more friendly.
    -   Change "+ New Tag" to "+tag".
    -   Change the deselect file button to a grey color.
    -   Change the info box header to "Selected Files".
    -   Change the info icon to a pencil icon.

## V0.2.11

### Date: 1/31/2019

#### Changes:

-   Changed the "X" used to deselect files into a "-" sign.
-   Added the ability to show a QR code linking to the session the current user is in.

## V0.2.10

### Date: 1/31/2019

#### Changes:

-   Added two different modes to help control what the user is interacting with
    -   The "Files" mode allows dragging files and making new files.
    -   The "Worksurfaces" mode allows dragging worksurfaces, making new worksurfaces, and interacting via clicking on them.
-   Re-added the ability to combine files
    -   Dragging a file onto another file will combine them if possible.
    -   If no filters match then the files will stack.

## V0.2.9

### Date: 1/31/2019

#### Changes:

-   Camera zooming with trackpad pinching is now supported.
-   Input now handles `WheelEvent` from the browser.
    -   `getWheelMoved()` - Returns true when wheel movemented detected.
    -   `getWheelData()` - Return wheel event data for the current frame.

## V0.2.8

### Date: 1/31/2019

#### Changes:

-   Disabled double-tap to zoom functionality that is added by iOS and Android by default.
-   Fixed an issue where files would all appear in the same spot upon first load of a session.
-   Added the Session ID to the top header.
-   After logging in, the user will now be redirected back to the session they first tried accessing.
-   Fixed some typos.

## V0.2.7

### Date: 1/30/2019

#### Changes:

-   Added `line.to` and `line.color` tags. `line.to` creates an arrow that points from the source file to the target file. An array of files is also supported.
-   Added formula support for `label`, `label.color`.
-   Added some functions to `FileCalculations` to help with handling of short file ids:
    -   `getShortId` - Return the short id for the file.
    -   `fileFromShortId` - Find file that matches the short id.
    -   `filesFromShortIds` - Find files that match the short ids.
-   Disabled depth buffer writing for the new SDF rendered font.
-   Running `updateMatrixWorld` function for `FileMesh` when its position is updated.
    -   This allows child objects to have accurate world positioning the moment its parent is moved instead of waiting for ThreeJS to run the next render update frame.

## V0.2.6

### Date: 1/28/2019

#### Changes:

-   Improved the game window to resize the renderer and camera automatically
-   Improved how the files window scales for small devices
-   Move the toolbar into a floating action button
-   Closing the info box now shows an icon in its place that can be used to reopen it
-   Selecting/changing files no longer re-opens the info box
-   Tags that the user adds to the info box are no longer automatically hidden

## V0.2.5

### Date: 1/28/2019

#### Changes:

-   Rotation with touch input now spins in the correct direction.
-   3D text rendering is now done with SDF (Signed Distance Field). This gives us a much cleaner and crisper text representation.
-   Added `label.color` tag that allows you to change the color of the label text.

## V0.2.4

### Date: 1/28/2019

In this version we improved workspaces and made other minor quality of life improvements.

#### Changes:

-   Added the ability to change hex heights
-   Added the ability to stack cubes on top of each other
-   Added the ability to drag single hex tiles onto other workspaces
-   Added a `list()` formula function that is able to calculate which files are stacked on top of each other.
-   Made the square grid tiles visible only if they are over a related hex tile
-   Made hexes have a short height by default
-   Made hexes larger by default
-   Made cubes always attach to a workspace
-   Made only the grid that a cube is being dragged onto visible

##V0.2.1
###Date: 1/22/2019
In this version we added support for multiple simultaneous sessions. When logging in users can optionally provide a “Session ID” that will put them into that session. Alternatively, they can type the Session ID into the URL and go there directly. Sharing URLs to share your session is also supported.

#### Changes:

-   Multi-Session Support
    -   Users enter in a Session ID to go to a sandbox all their own.
    -   They can also share the URL with other people to be put directly into that session.
-   Hexes no longer have bevels.
-   In Formulas, hashtag expressions which have only a single result now return that result directly instead of in an array.
    -   For example, If there was only one file with a #sum set to “10” and there was a formula “=#sum”
        -   In v0.2.0 the formula would equal “[10]”
        -   In v0.2.1 the formula would equal “10”

## V0.2.0

### Date: 1/16/2019

In this version we added support for offline mode and made general improvements to the user interface.

#### Changes:

-   Added offline mode
    -   After loading the app over HTTPS, the user will be able to go completely offline (airplane mode) and still be able to access everything. This means:
        -   The app should load
        -   The user should be able to create new files and workspaces
        -   They should be able to edit tags and perform actions.
    -   When new app versions are available, the user will be prompted to refresh the page to use the new version.
        When the user goes back online the app will attempt to sync with the server. If successful, then everyone else will be able to see their changes because they have been synced.
    -   If syncing is not successful, then this is because of one or more merge conflicts between the user’s version and the server’s version.
        -   Merge conflicts happen when two users edit the same tag to different values.
        -   The computer doesn’t know which is the most valid so it has to ask the user.
    -   When merge conflicts happen a notification will pop up and prompt the user to fix them.
        -   This prompt will also be in the side bar underneath the hamburger menu.
    -   Until the user fixes the merge conflicts any changes they make will not be synced to the server.
    -   When the user fixes the merge conflicts, their state is synced to the server and everyone is able to see it.
    -   The sidebar will show the current online/offline synced/not synced status. Right clicking it will give the option to force the app into offline mode for testing and vice versa.
-   Added a nuke button
    -   This button allows the user to delete everything in the website.
    -   This is only for testing so don’t expect it to work in all cases. In particular, don’t expect it to work super well when there are multiple people on the site at a time.
-   Removed test buttons from the sidebar
-   Changed the version number to be based on the latest annotated git tag. This will let us have full control over the version numbers while making them a lot more human readable. Upon hover it will also show the git commit hash that the build was made from.
