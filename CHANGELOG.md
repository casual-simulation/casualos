# AUX Changelog

## V0.7.0

### Date: TBD

### Changes:

-   Improvements
    -   Search bar will now always remain across the top of builder.
-   Bug Fixes
    -   Allow for the expansion and shrinking of hexes after they have been raised or lowered.
    -   Clicking on the diff bursh in builder will now make the sheets appear correctly.
    -   Selecting the file ID in builder will now no longer change the zoom that sent the camera too far away.
    -   Upon shrinking the hex grid, hexes will now remain if a file is on top of it.
    -   Clicking on a non centeral hex did not show correct raise and lower options, now it does.

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
