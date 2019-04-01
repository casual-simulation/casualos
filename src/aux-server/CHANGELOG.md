# AUX Server Changelog

## V0.3.25
### Date: 4/01/2019

### Changes:
- Bug Fixes
  - Fixed HTML Element targets not being captured as intended when using touch.
    - This fixes inventory dragging for mobile.
  - Fixed the ability to use indexer expressions in filters after @ or # queries.
    - `=@nums()[0]` gets the first file with the `nums` tag on it.
  - Fixed the ability to call functions in filters after @ or # queries.
    - `=#nums().map(num => num + 10)` now works and produces a list of numbers where each number has 10 added to it.
  - Fixed the ability to upload AUX files.
  - Improved garbage collection so that it avoids expensive operations when there is nothing to remove.
  - Fixed offline mode to work offline(!).
- Other improvements
  - Formulas now support using dots after @ or # queries. For example `=@name('bob').name` now works.
  -  Debug Page
    - The debug page for AUX Builder has been moved to be after the simulation ID. So to access the debug page for `test` you would go to `https://auxbuilder.com/test/aux-debug`.
    - The debug page now has a search bar that allows entering a formula to search through the file state.
    - Added the ability for the debug page to search through destroyed files.
  - Atom signatures are now only checked when adding individual atoms. This greatly improves loading performance.
  - Refactored some of the logic around propagating file updates so that they can be more performant in the future.
  - Destroying files by dragging them off of a worksurface or using the `destroy()` function in an action now uses the causal tree instead of setting the `_destroyed` tag to `true`. (Allows better garbage collection in the future)
  - Improved first load performance by reducing the amount of work the browser needs to do to store a tree in IndexedDB.
  - Improved performance for inserting atoms into the weave.

## V0.3.24
### Date: 3/28/2019

### Changes:
- Features:
  - Can drag files to and from user's inventory in AUX Player.
  - Added support for cryptograhpically signing and verifiying events.
  - Renamed `scale.x`, `scale.y`, and `scale.z` to `aux.scale.x`, `aux.scale.y`, and `aux.scale.z`.
  - Added the ability to use `aux.scale` to uniformly scale the file.
- Bug Fixes
  - Use context.z position has an offset from the calculated display z position in Aux Builder.
    - Making context.z act as an offset allows context.z value of 0 to place the file on the “ground” regardless of tile height in Aux Builder and always place the file on the ground in Aux Builder.
    - No more file clipping issues due to grid planes being at different heights between Aux Builder and Aux Player.
  - Don't clear out tags that end with `.x`, `.y`, or `.z` when dragging new files from the recent files list.
  - Fixed an issue with trees that could cause sibling atoms to be ignored or ordered improperly.
- Other Improvements
  - Builder context file now defaults to flat, clear, and not movable.


## V0.3.23
### Date: 3/26/2019

### Changes:
- Features
  - Can drag and combine files in AUX Player.
- Buf Fixes
  - Can snap hexes together again as long as there is no file on it (currently this includes the builder context file as well).
  - Fixed an issue that allowed files representing worksurfaces to be dragged even if `aux.movable` was set to `false`.
  - Fixed an issue that allowed files to be stacked on top of invisible files that were representing users.
  
## V0.3.22
### Date: 3/26/2019

### Changes:
- Bug Fixes
    - Fixed an issue where atoms could be placed in the wrong spot.
    - Fixed an issue with importing atoms where the tree could become invalid.
- Other Improvements
    - Added some core functionality for the infinite mathematical grid in AUX Player.

## V0.3.21
### Date: 3/24/2019

### Changes:
- Bug Fixes
    - Fixed an issue where the server would start handing out old site IDs after a restart.
    - Added the ability to reject events that become corrupted while in transit.

## V0.3.20
### Date: 3/23/2019

### Changes:
- Bug Fixes
    - Fixed another scenario where duplicate atoms could be added to a weave.

## V0.3.19
### Date: 3/23/2019

### Changes:
- Bug Fixes
    - Fixed Weaves to prevent duplicate atoms from being added in specific scenarios.
        - This would cause peers to reject changes from each other.
        - If the issue happened on the server then every client would reject data from the server until the server was restarted.
        - The restart would cause the server to reload the atoms from the database, eliminating any duplicates.
    - Fixed signing out and signing back in on AUX Player to put the user back in the context they were previously in.
    - Fixed an issue that caused users to be invisible the first time they signed into an AUX Player context.

## V0.3.18
### Date: 3/23/2019

### Changes:
- Bug Fixes
    - Fixed so that users can actually log out.
    - Fixed AR mode in AUX Player.
- Other Improvements
    - Added a progress spinner to the login pages.
    - Added lerping to the user meshes so the position updates look more natural.

## V0.3.17
### Date: 3/22/2019

### Changes:
- Bug Fixes
    - Fixed so that updates are only sent every 1/2 second instead of up to every frame.

## V0.3.16
### Date: 3/22/2019

### Changes:
- Bug Fixes
    - Fixed an issue that would cause two browser tabs to go to war over which was the real tab for that user.
    - Fixed an issue that would cause two browser tabs to potentially become inconsistent with each other because they were sharing the same site ID.
- Other Changes
    - Added a couple extra logs to MongoDBTreeStore.
    - Added additional safegards against invalid events.

## V0.3.15
### Date: 3/22/2019

### Changes:
- Bug Fixes
    - Fixed an issue that prevented users from creating new simulations.
    - Fixed an issue that caused duplicate files to be created in the game view.
    - Fixed issues with logging in as the same user from different devices.
    - Fixed an issue that would cause newly created trees to have garbage collection disabled.
- Other Improvements
    - Improved word bubble performance.
    - Improved performance when loading large causal trees.
    - Added additional validations when importing trees to prevent errors down the road.
    - Improved the server to add a root atom if loading a tree that has no atoms.

## V0.3.14
### Date: 3/22/2019

### Changes:
- Bug Fixes
    - Fixed CausalTreeServer to save imported atoms.
    - Fixed CausalTreeServer to not re-store atoms each time it loads the tree from the database.
    - Make CausalTree export version 3 trees.
    - Make CausalTree collect garbage after importing.
- Other Changes
    - Enable some debug logs.

## V0.3.13
### Date: 3/21/2019

### Changes:
- Bug Fixes
    - Reduced memory usage of worksurfaces. This makes it easier to create large worksurfaces.
    - Fixed not being able to drag the camera around when tapping/clicking on a worksurface while in files mode.
    - Added indexes to MongoDB collections so that queries won't be so slow.


## V0.3.12
### Date: 3/21/2019

### Changes:
- Bug Fixes
    - Fixed issues with slowdowns caused by continually re-saving the entire history.
    - Fixed several performance issues related to labels and word bubbles.
    - Changed the branding to AUX Builder from File Simulator.
    - Fixed several issues with files and contexts in AUX Player.
        - Files marked as `_destroyed` now no longer display.
        - Fixed a loading order issue that would occur when a file was its own context.
        - Fixed an issue that would cause the player to ignore the file removed event for the context file.
    - Fixed Word Bubbles so that they scale with labels when `aux.label.size.mode` is set to `auto`.
- AUX Player Improvements
    - Users now show up inside contexts in both AUX Builder and AUX Player.
    - The `_lastActiveTime` tag is now per-context. (i.e. `context_a._lastActiveTime`)
- AUX Builder Improvements
    - Added the ability to fork simulations.
- Other Improvements
    - Added the ability to transparently upgrade our storage formats.
        - Works for both MongoDB and IndexedDB.
    - Made the server respond to the local IP Addresses by default in Development mode.
        - This makes it easier to do development with a mobile device.
        - Use `npm run watch:player` to have it serve the AUX Player by default. Otherwise it will serve the AUX Builder.
    - Improved formula query expresions to support tags with dots in them.
        - Before you would have to wrap the tag in a string.
        - Now you can simply do `@aux.label` or `#aux.label` as long as each part is a valid [JS identifier](https://developer.mozilla.org/en-US/docs/Glossary/Identifier).

## V0.3.11
### Date: 3/19/2019

### Changes:
- Bug Fixes
    - Fixed dragging worksurfaces while in files mode.
    - Fixed an issue in Aux Player that caused a file to still be visible even if it was destroyed.
    - Fixed a login issue that would cause the user to get stuck in a redirect loop.
    - Fixed shouts.
    - Fixed AUX File upload to overwrite existing state instead of trying to merge the two trees.
        - This allows us to keep better consistency across multiple devices.
    - Fixed user labels.
- Formula Improvements
    - Improved formulas allow using normal dot syntax for tags with dots in them.
        - This means you can now do `this.aux.color` instead of `this['aux.color']`
        - As a result of this change, primitive values (number, string, boolean) are converted to objects.
        - So to do equality comparisions you must use the `==` operator instead of either `!` or `===`.
        - Numerical operators and other comparision operators still work fine.
        - You can alternatively use the `valueOf()` function to convert the object back into a primitive value.
    - Added the ability to change a file value simply by changing it.
        - This means instead of doing `copy(this, { "aux.color": "red" })` you can now do `this.aux.color = "red"`.
        - Additionally, we no longer destroy files by default.
        - This means that the destroy/recreate pattern is basically deprecated. This pattern worked in simple scenarios, but for more complex scenarios it could easily cause race conditions where duplicate files are created because users clicked the same file at the same time.
- Other Improvements
    - Improved the `goToContext()` formula function to be able to accept a single parameter that indicates the context to go to.
        - The function will infer the current simulation ID from the URL.

## V0.3.10
### Date: 3/18/2019

### Changes:
- Fixed aux upload.

## V0.3.9
### Date: 3/18/2019

### Changes:
- Fixed Aux Player file added event ordering.
- Reworked actions function to take an arbitrary number of files.
- Added ability to have tag filters that match everything.
- Added `shout` formula function.
    ```
    shout(eventName)
    ```
- Added `goToContext` formula function.
    ```
    goToContext(simulationId, contextId)
    ```
- Calling `onClick` action on file that gets clicked by the user in Aux Player.
- Fixed Aux Player showing destroyed files.

## V0.3.8
### Date: 3/18/2019

### Changes:
- Changed configurations to allow auxplayer.com and auxbuilder.com

## V0.3.7
### Date: 3/17/2019

### Changes:
- Added InventoryContext to hold onto user’s inventory data much in the same way Context3D does (WIP). Ported over some MiniFile stuff from Aux Projector to get inventory display framework up (WIP).
- Renamed pointOnGrid to pointOnWorkspaceGrid for clarification.

## V0.3.6
### Date: 3/15/2019

### Changes:
- Changed to using Causal Trees for history.
    - **This is a breaking change**
    - This gives us the ability to support offline mode and keep action history.
    - Because of how the system is designed, every merge conflict can be resolved in a reasonable manner.
    - This is a new storage format, so data needs to be migrated.
    - This is also fairly new, so it may have some weird bugs.
- Removed file types.
    - **This is a breaking change**
    - This allows any file to visualize any grouping of files. (e.g. look like a worksurface)
    - As a result, the only difference between a file and a worksurface is what tags the file has.
    - This means that new worksurfaces will have a file on them by default. This file is the data for the worksurface.
    - To create a workspace:
        - Make a file that has `builder.context` set to any value.
        - This value is the context that the file is visualizing.
        - _To make other files show up in this context you simply create a tag with the same name as the context as set its value to `true`._
        - **Note that when you create a worksurface in worksurface mode we do this for you automatically.**
    - A couple tags were changed:
        - `_position`
            - Split into 3 different tags. (x, y, z)
            - To change the position of a file you use `{context}.x`, `{context}.y`, and `{context}.z` as the tag names.
        - `_workspace`
            - Now to place a file on a workspace you set the `{context}` tag to `true`
        - All existing tags have been moved to the `aux` namespace.
            - This affects `color`, `scale`, `stroke`, `line`, `label`, `movable`, and `stackable`.
            - They have been changed to `aux.color`, `aux.scale`, `aux.stroke`, `aux.line`, `aux.label`, `aux.movable`, and `aux.stackable`.
        - `_hidden`
            - This option has been removed in favor of setting the `aux.color` tag to `transparent` or `clear`.
            - To remove the lines you simply need to set the `stroke.color` tag to `transparent`/`clear`.
    - Several new tags were added:
        - `builder.context`
            - Setting this to a value will cause the file to visualize the context that was specified.
            - This means appearing like a worksurface and showing any files that have the related `{context}` tag set to `true`.
        - `builder.context.x`, `builder.context.y`, `builder.context.z`,
            - These tags specify the X, Y, and Z positions that the center of the worksurface is placed at.
        - `builder.context.scale`
            - This tag specifies the scale of the worksurface. (how big it is)
        - `builder.context.grid.scale`
            - This tag specifies the scale of the grid relative to the worksurface. (how big the grid squares are)
        - `builder.context.defaultHeight`
            - This tag specifies how tall the hexes on the worksurface are by default.
        - `builder.context.size`
            - This tag specifies how many hexes from the center the worksurface contains.
        - `builder.context.minimized`
            - This tag specifies whether the worksurface is minimized.
        - `builder.context.color`
            - This tag specifies the color that the worksurface is.

## V0.3.5
### Date: 2/26/2019

### Changes:
- Fixed AR mode.
- Restoring original background color when exiting AR mode.

## V0.3.4
### Date: 2/25/2019

### Changes:
- Added stub for AUX Player. 
- Added subdomains for File Simulator (projector.filesimulator.com) and AUX Player (player.filesimulator.com).
- Lots of file reorganization.
  - `aux-projector` and `aux-player` are now togethor underneath `aux-web` along with any other common/shared files.
- Fixed combining.

## V0.3.3
### Date: 2/21/2019

### Changes:
- Implemented a word bubble to help make file labels more readable.

## V0.3.2
## Data: 2/21/2019

### Changes:
- Nothing, just trying to get npm flow setup.

## V0.3.1
### Date: 2/20/2019

### Changes:
- Added the ability to delete files by dragging them off a workspace.
- Fixed the `destroy()` function in action scripts.

## V0.3.0
### Date: 2/14/2019

### Changes:
- Added a recursion check to the formula evaluation code to prevent infinite loops from locking up the system.

## V0.2.30
### Date: 2/13/2019

### Changes:
- Added Aux Debug page that can be reached by prepending `/aux-debug/` to your simulation id in the url. 
  - This page presents the AUX data in its raw JSON form and is updated live when changes arrive from the server.
  - If you wanted to see the raw data for a simulation called `RyanIsSoCool` you would go to: `filesimulator.com/aux-debug/RyanIsSoCool`.
- Add the ability to drag a stack of files
  - For some reason the stack doesn't always move at the same time.
  - It's some weird issue with not updating them fast enough or something.
- Debounce updates to the recents list so that we're not forcing re-renders of the mini files all the time
- Fix so that dragging new files doesn't cause a ton to get created
- Cause formulas to be run when evaluating filters
  - This also fixes the issue of numbers and true/false values not matching filters
- Allow combining files that were just dragged from the file queue
- Hide files without workspaces
  - Also log out the file ID when this happens.
  
## V0.2.29
### Date: 2/13/2019

### Changes:
- Fixed workspace mesh not updating properly.
- Remove workspace if size is 0.
  - Only allow shrinking of a workspace to 0 if there are no files on the workspace.
- Implemented cleanup of a file's arrows/lines when it is destroyed.

## V0.2.28
### Date: 2/12/2019

### Changes:
- Make the recent files list use 3D renders of the actual files.
- Fixed issues with the lines not updating when worksurfaces minimize.
- Disabled shadows.

## V0.2.27
### Date: 2/11/2019

### Changes:
- Fix the weirdest bug that was caused by an internal error in Vue.js.
  - It would do something to stop the touch events from being emitted.
  - I'm not sure how it did that. Maybe changing focus or something.

## V0.2.26
### Date: 2/11/2019

### Changes:
- Fixed touch scrolling.
- Fixed an issue that would prevent immovable files from being dragged off of the recent files list.
- Fixed an issue that allowed players to place files on minimized worksurfaces.
- Fixed an issue that allowed minimized worksurfaces to snap together.
- Made the recents list have 3 files at most.
- Made files in the recents list not duplicate as long as their normal values are the same.
- Made selecting a file in the recents list move the selected file to the front.
- Made the first file in the list larger than the others.
- Made dragging a file from the recents list not move the dragged file to the front of the list.

## V0.2.25
### Date: 2/11/2019

### Changes:
- Added the first version of the file toolbar.
  - This is a list of the user's recently edited files.
  - Users can select a file from the toolbar to tap and place.
  - They can also click and drag files out into the world.
- Made minimized hexes 1/3 the scale of normal hexes.
- Added the ability to minimize hexes while in file mode.
- Moved extra buttons like the AR mode to the app sidebar.
- Made the login email box into a name box.
- Fixed destroyed blocks not dissapearing.
- Made the tag input field use a placeholder instead of filling with actual text.
- Fixed some input issues.

## V0.2.24
### Date: 2/8/2019

### Changes:
- Scaled down color picker, removed scrolling, and made it slightly wider to accommodate mobile screens.
- It is now possible to close the Color Picker by tapping on empty space (it will no longer open immediately when tapping of of it).
- Allow camera dragging when performing click operation on file that is incompatible with the current user mode.
- Prevent the user from changing the background color when in AR mode.
- Added the ability to see other people and what they are looking at.
- Added the ability to minimize worksurfaces. 
  - While minimized they can still be dragged around but changing the size and height is not allowed.
  - The color can still be changed though.
- Fixed an issue where everyone would try to initialize the globals file with the default color and get a merge conflict if it was different.

## V0.2.23
### Date: 2/7/2019

### Changes:
- Made the info box default to closed.
- Added initial version of WebXR support.
  - Note that this is Mozilla's old crotchety WebXR and not the official standardized version.
  - As such, it only works in Mozilla's WebXR Viewer app thing.
  - Hopefully it doesn't break WebVR support.
- Changed color picker to swatches style.
- Can only change scene background color while in workspaces mode.
- Changed `stroke.linewidth` to be `stroke.width`.

## V0.2.22
### Date: 2/7/2019

### Changes:
- Color Picker component is now more generic. It invokes a callback function every time the color value changes that you can use to get the color value.
- Made the QR code larger.
- Change the scene’s background color by clicking on it and using the color picker.
- Make basically all the text gray (title bar text, mode switch, add buttons, and the hamburger).
- Changed color picker type to Compact style.

## V0.2.21
### Date: 2/7/2019

### Changes:
- Changed the top bar and other buttons to have a white background.
- Changed the red badge on the pencil to be a neutral gray.
- Changed the actions icon.
- Added a grid that is visible in hex edit mode.

## V0.2.20
### Date: 2/7/2019

### Changes:
- Added color picker component.
- Can change workspace color using color picker from the context menu.
- Inverted touch input vertical rotation. 
- Clamping vertical rotation so that you can’t rotate underneath the ground plane.
  
## V0.2.19
### Date: 2/6/2019

### Changes:
- Added `stroke.linewidth` to control how thick the stroke lines are.
- Removed the Skybox.
- Added the ability to change the vertical tilt of the camera by using two fingers and panning up and down. 
- Reworked the files panel to be easier to use.
  - Added "+action" button for creating actions.
  - Moved the "+tag" and "+action" buttons above the file table.
  - Moved the "Clear selection" button to the header row on the file table.
  - It still needs some of the scrolling features like not scrolling the header while scrolling the body of the table but for the most part it's done.
  - Also needs the auto-zoom feature for users. After looking at possible implementations I've discovered that it should be easier to do this when the "seeing other people" update arrives.


## V0.2.18
### Date: 2/5/2019

### Changes:
- Button polling is now implemented in `InputVR` for vr controllers: `getButtonDown`, `getButtonHeld`, `getButtonUp`.
- Replaced `GameView.workspacePlane` with mathematical plane for workspace dragging.
  - This fixes not being able to drag workspaces after we disabled the ground plane mesh.
- Forcing touch input when being used on a VR capable device in non-VR mode. This fixes traditional browser input on devices like the Oculus Go.

## V0.2.17
### Date: 2/5/2019

### Changes:
- Moved VR controller code to `InputVR` class. 
- Forcefully disconnecting the controller when exiting VR, this fixes bug with GamePad API when returning to VR mode.
- Disabled visibility of scene’s ground plane. 
- `ControllerMesh` is now a special `Object3D` that is added to the root controller `Object3D` node.

## V0.2.16 
### Date: 2/5/2019

### Changes:
- Controller is represented as a red pointer arrow. It doesnt not currently allow you to interact yet.
- Disabling shadows when in VR. Shadows are a significant performance cost in its current state, disabling them gives us 20-30+ fps boost in VR.
- VR button is now hidden when WebVR is not detected.

## V0.2.15
### Date: 2/5/2019

#### Changes: 
- Changed the default cube color to be white.
- Changed the default cube outline color to gray instead of invisible.
- Fixed an issue with action filters where some values weren't able to be matched to a filter.
  - This happened for some tag values that would be parsed from strings into their semantic equivalents.
  - For example, `"true"` would get converted to `true` and `"123.456"` would get converted to `123.456`.
  - This conversion was being ignored for filter values, so they would never match in these scenarios.
- Fixed an issue with action scripts where copying a file would not copy its formulas.
- Improved the `copy()` function used in action scripts to be able accept any number of arguments.
  - This allows cascading scenarios like `copy(this, that, @name("joe"), @name("bob"))`.

## V0.2.14
### Date: 2/4/2019

#### Changes: 
- Added `scale.x`, `scale.y`, and `scale.z` tags to allow changing the scale of the cubes.
  - `x` and `y` are width and thickness. `z` is height.
- Dragging worksurfaces now no longer snaps to the center but stays relative to the cursor position.
- Added `label.size` and `label.size.mode` tags.
  - `label.size` sets the size of the label. Setting it to 1 means the default size and setting it to 2 means twice the default size.
  - Setting `label.size.mode` to `"auto"` causes the label to appear a constant size no matter where the user's camera is in the scene.
- Changed the renderer settings to render the 3D scene at the full device resolution.
  - This will likely increase the accuracy of rendering results but may also cause performance to drop due to rendering a lot more pixels.
  - Was previously using the browser-default pixel ratio.
- Added beta support for Web VR devices.
- Fixed an issue where worksurfaces that did not have default heights and were merged into other worksurfaces would cause those tiles to incorrectly appear with a height of `0`.
  - The worksurfaces that did not have default heights were from old versions that did not allow changing heights.
- Added the number of selected cubes to the info box toggle

## V0.2.13
### Date: 2/1/2019

#### Changes: 
- Camera now handles going from two touch -> one touch without jumping around.
- Removed time instance in `Time.ts`.
- Input and Time are both updated manually through `GameView`, we need less `requestAnimationFrame` calls when possible.
- Fixed bug in `Input` that would cause touches to overwrite old ones on browsers that reuse `TouchEvent` identifiers.
- Remaining `TouchData` finger indexes get normalized when touches are removed. 
  - i.e. if there are two touches and touch 0 gets removed, then touch 1 becomes touch 0.

## V0.2.12
### Date: 2/1/2019

#### Changes:
- Added `#stroke.color` which sets an outline on the cube.
- Added the ability to download `.aux` files.
- Added the ability to upload `.aux` files into the current session.
- Changed the URLs to not use `#`. (breaking change!)
- Changed the home screen to be the root path (`/`) so sessions are now just `filesimulator.com/mysession`. (breaking change!)
- Changed the login screen to be at `/login`. (So `login` is not a valid session ID anymore) (breaking change!)
- Fixed an issue where destroyed objects were being returned in action script queries.
- Fixed an issue that allowed files to be combined with themselves. (Sorry Jeremy!)
- Fixed an issue where offline users would always overwrite file `_index` values if the index was at `0.`
- Minor changes:
  - Add a "continue as guest" button.
  - Replace "File Simulator" with the session code unless they are in the default session.
  - Disable auto-capitalization and autocorrect on the input fields.
  - Change the "Add worksurface" and "Add file" buttons to just be a "+" icon.
  - Change the mode switch to use icons instead of text for the label.
  - Make the mode switch always appear white.
  - Remove color integration from FileValue.
  - Change "Nuke the site" to something a little more friendly.
  - Change "+ New Tag" to "+tag".
  - Change the deselect file button to a grey color.
  - Change the info box header to "Selected Files".
  - Change the info icon to a pencil icon.


## V0.2.11
### Date: 1/31/2019

#### Changes:
- Changed the "X" used to deselect files into a "-" sign.
- Added the ability to show a QR code linking to the session the current user is in.

## V0.2.10
### Date: 1/31/2019

#### Changes:
- Added two different modes to help control what the user is interacting with
  - The "Files" mode allows dragging files and making new files.
  - The "Worksurfaces" mode allows dragging worksurfaces, making new worksurfaces, and interacting via clicking on them.
- Re-added the ability to combine files
  - Dragging a file onto another file will combine them if possible.
  - If no filters match then the files will stack.

## V0.2.9
### Date: 1/31/2019

#### Changes:
- Camera zooming with trackpad pinching is now supported.
- Input now handles `WheelEvent` from the browser.
  - `getWheelMoved()` - Returns true when wheel movemented detected.
  - `getWheelData()` - Return wheel event data for the current frame.

## V0.2.8
### Date: 1/31/2019

#### Changes:
- Disabled double-tap to zoom functionality that is added by iOS and Android by default.
- Fixed an issue where files would all appear in the same spot upon first load of a session.
- Added the Session ID to the top header.
- After logging in, the user will now be redirected back to the session they first tried accessing.
- Fixed some typos.

## V0.2.7
### Date: 1/30/2019

#### Changes:
- Added `line.to` and `line.color` tags. `line.to` creates an arrow that points from the source file to the target file. An array of files is also supported.
- Added formula support for `label`, `label.color`.
- Added some functions to `FileCalculations` to help with handling of short file ids:
  - `getShortId` - Return the short id for the file.
  - `fileFromShortId` - Find file that matches the short id.
  - `filesFromShortIds` - Find files that match the short ids.
- Disabled depth buffer writing for the new SDF rendered font.
- Running `updateMatrixWorld` function for `FileMesh` when its position is updated.
  - This allows child objects to have accurate world positioning the moment its parent is moved instead of waiting for ThreeJS to run the next render update frame.

## V0.2.6
### Date: 1/28/2019

#### Changes:
- Improved the game window to resize the renderer and camera automatically
- Improved how the files window scales for small devices
- Move the toolbar into a floating action button
- Closing the info box now shows an icon in its place that can be used to reopen it
- Selecting/changing files no longer re-opens the info box
- Tags that the user adds to the info box are no longer automatically hidden

## V0.2.5
### Date: 1/28/2019

#### Changes:
- Rotation with touch input now spins in the correct direction.
- 3D text rendering is now done with SDF (Signed Distance Field). This gives us a much cleaner and crisper text representation.
- Added `label.color` tag that allows you to change the color of the label text.


## V0.2.4
### Date: 1/28/2019
In this version we improved workspaces and made other minor quality of life improvements.

#### Changes:
- Added the ability to change hex heights
- Added the ability to stack cubes on top of each other
- Added the ability to drag single hex tiles onto other workspaces
- Added a `list()` formula function that is able to calculate which files are stacked on top of each other.
- Made the square grid tiles visible only if they are over a related hex tile
- Made hexes have a short height by default
- Made hexes larger by default
- Made cubes always attach to a workspace
- Made only the grid that a cube is being dragged onto visible


##V0.2.1
###Date: 1/22/2019
In this version we added support for multiple simultaneous sessions. When logging in users can optionally provide a “Session ID” that will put them into that session. Alternatively, they can type the Session ID into the URL and go there directly. Sharing URLs to share your session is also supported.

#### Changes:
- Multi-Session Support
  - Users enter in a Session ID to go to a sandbox all their own.
  - They can also share the URL with other people to be put directly into that session.
- Hexes no longer have bevels.
- In Formulas, hashtag expressions which have only a single result now return that result directly instead of in an array.
  - For example, If there was only one file with a #sum set to “10” and there was a formula “=#sum”
    - In v0.2.0 the formula would equal “[10]”
    - In v0.2.1 the formula would equal “10”


## V0.2.0
### Date: 1/16/2019
In this version we added support for offline mode and made general improvements to the user interface.

#### Changes:
- Added offline mode
  - After loading the app over HTTPS, the user will be able to go completely offline (airplane mode) and still be able to access everything. This means:
    - The app should load
    - The user should be able to create new files and workspaces
    - They should be able to edit tags and perform actions.
  - When new app versions are available, the user will be prompted to refresh the page to use the new version.
When the user goes back online the app will attempt to sync with the server. If successful, then everyone else will be able to see their changes because they have been synced.
  - If syncing is not successful, then this is because of one or more merge conflicts between the user’s version and the server’s version.
    - Merge conflicts happen when two users edit the same tag to different values.
    - The computer doesn’t know which is the most valid so it has to ask the user.
  - When merge conflicts happen a notification will pop up and prompt the user to fix them.
    - This prompt will also be in the side bar underneath the hamburger menu.
  - Until the user fixes the merge conflicts any changes they make will not be synced to the server.
  - When the user fixes the merge conflicts, their state is synced to the server and everyone is able to see it.
  - The sidebar will show the current online/offline synced/not synced status. Right clicking it will give the option to force the app into offline mode for testing and vice versa.
- Added a nuke button
  - This button allows the user to delete everything in the website.
  - This is only for testing so don’t expect it to work in all cases. In particular, don’t expect it to work super well when there are multiple people on the site at a time.
- Removed test buttons from the sidebar
- Changed the version number to be based on the latest annotated git tag. This will let us have full control over the version numbers while making them a lot more human readable. Upon hover it will also show the git commit hash that the build was made from.
