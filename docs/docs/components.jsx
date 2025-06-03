import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Info from './api-info/extra-types.json';

export const PossibleValuesTable = ({children}) => (
  <table>
    <thead>
      <tr>
        <th>Value</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      {children}
    </tbody>
  </table>
);

export const PossibleValue = ({value, children, ...attributes}) => (
  <tr {...attributes}>
    <td>{value}</td>
    <td>{children}</td>
  </tr>
);

export const PossibleValueCode = ({value, children, ...attributes}) => (
  <PossibleValue value={
    <code>{value}</code>
  } {...attributes}>{children}</PossibleValue>
);

export const AnyColorValues = ({}) => (<React.Fragment>
  <PossibleValue value='Any X11 Color'>
    <a href='https://en.wikipedia.org/wiki/X11_color_names' target='_blank'>X11 colors</a> are a list of standard colors that web browsers support.
  </PossibleValue>
  <PossibleValue value='Any Hex Color'>
    <a href='https://en.wikipedia.org/wiki/Web_colors#Hex_triplet' target='_blank'>Hex colors</a> are three or six digit numbers that specify a color by its red, green, and blue components.
  </PossibleValue>
</React.Fragment>);

export const TagLink = ({tag}) => tag.startsWith('@') ? 
  (<ListenTagLink tag={tag}/>) : 
  (<DataTagLink tag={tag}/>);

export const AnyCursorValues = ({}) => (<React.Fragment>
  <PossibleValueCode value='auto'>
      The cursor automatically changes its look based on the context.
      For grid portal bots, this means that the arrow cursor is used.
      For menu portal bots, this means that the pointer is used when the bot has a <TagLink tag='@onClick'/> and the arrow is used otherwise. (default)
  </PossibleValueCode>
  <PossibleValueCode value='default'>
      The cursor looks like the default cursor for the platform.
      Generally, this means the arrow cursor.
  </PossibleValueCode>
  <PossibleValueCode value='none'>
      The cursor is invisible.
  </PossibleValueCode>
  <PossibleValueCode value='wait'>wait</PossibleValueCode>
  <PossibleValueCode value='context-menu'>context-menu</PossibleValueCode>
  <PossibleValueCode value='help'>help</PossibleValueCode>
  <PossibleValueCode value='pointer'>pointer</PossibleValueCode>
  <PossibleValueCode value='progress'>progress</PossibleValueCode>
  <PossibleValueCode value='cell'>cell</PossibleValueCode>
  <PossibleValueCode value='crosshair'>crosshair</PossibleValueCode>
  <PossibleValueCode value='text'>text</PossibleValueCode>
  <PossibleValueCode value='vertical-text'>vertical-text</PossibleValueCode>
  <PossibleValueCode value='alias'>alias</PossibleValueCode>
  <PossibleValueCode value='copy'>copy</PossibleValueCode>
  <PossibleValueCode value='move'>move</PossibleValueCode>
  <PossibleValueCode value='no-drop'>no-drop</PossibleValueCode>
  <PossibleValueCode value='not-allowed'>not-allowed</PossibleValueCode>
  <PossibleValueCode value='grab'>grab</PossibleValueCode>
  <PossibleValueCode value='grabbing'>grabbing</PossibleValueCode>
  <PossibleValueCode value='all-scroll'>all-scroll</PossibleValueCode>
  <PossibleValueCode value='col-resize'>col-resize</PossibleValueCode>
  <PossibleValueCode value='row-resize'>row-resize</PossibleValueCode>
  <PossibleValueCode value='n-resize'>n-resize</PossibleValueCode>
  <PossibleValueCode value='e-resize'>e-resize</PossibleValueCode>
  <PossibleValueCode value='s-resize'>s-resize</PossibleValueCode>
  <PossibleValueCode value='w-resize'>w-resize</PossibleValueCode>
  <PossibleValueCode value='ne-resize'>ne-resize</PossibleValueCode>
  <PossibleValueCode value='nw-resize'>nw-resize</PossibleValueCode>
  <PossibleValueCode value='se-resize'>se-resize</PossibleValueCode>
  <PossibleValueCode value='sw-resize'>sw-resize</PossibleValueCode>
  <PossibleValueCode value='ew-resize'>ew-resize</PossibleValueCode>
  <PossibleValueCode value='ns-resize'>ns-resize</PossibleValueCode>
  <PossibleValueCode value='nesw-resize'>nesw-resize</PossibleValueCode>
  <PossibleValueCode value='nwse-resize'>nwse-resize</PossibleValueCode>
  <PossibleValueCode value='zoom-in'>zoom-in</PossibleValueCode>
  <PossibleValueCode value='zoom-out'>zoom-out</PossibleValueCode>
  <PossibleValue value='Any URL'>The image at the given URL will be used as the cursor. Images should be 32x32 pixels or smaller otherwise they may not work.</PossibleValue>
</React.Fragment>);

export const DataTagLink = ({tag}) => {
    if(tagMap[tag] === undefined) {
        throw new Error(`No tag map for tag ${tag}`);
    }
    return (
        <a href={relativeLink(tagMap[tag]) + '#' + tag.replace(/[\.\(\)\@\[\]]/g, '').toLowerCase()}>
            <NormalCode>#{tag}</NormalCode>
        </a>
    );
};
export const tagMap = {
    //tag-types
    boolean: 'tags',
    number: 'tags',
    string: 'tags',
    mod: 'tags',
    date: 'tags',
    vector: 'tags',
    rotation: 'tags',
    script: 'tags',
    //info
    id: 'tags/info',
    space: 'tags/info',
    creator: 'tags/info',
    //behavior
    draggable: 'tags/behavior',
    pointable: 'tags/behavior',
    focusable: 'tags/behavior',
    destroyable: 'tags/behavior',
    editable: 'tags/behavior',
    listening: 'tags/behavior',
    system: 'tags/behavior',
    //visualization
    color: 'tags/visualization',
    cursor: 'tags/visualization',
    cursorHotspot: 'tags/visualization',
    strokeColor: 'tags/visualization',
    strokeWidth: 'tags/visualization',
    lineTo: 'tags/visualization',
    lineStyle: 'tags/visualization',
    lineWidth: 'tags/visualization',
    lineColor: 'tags/visualization',
    label: 'tags/visualization',
    labelColor: 'tags/visualization',
    labelOpacity: 'tags/visualization',
    labelFontSize: 'tags/visualization',
    labelPadding: 'tags/visualization',
    labelPaddingX: 'tags/visualization',
    labelPaddingY: 'tags/visualization',
    labelSize: 'tags/visualization',
    labelSizeMode: 'tags/visualization',
    labelPosition: 'tags/visualization',
    labelAlignment: 'tags/visualization',
    labelFontAddress: 'tags/visualization',
    labelWordWrapMode: 'tags/visualization',
    labelFloatingBackgroundColor: 'tags/visualization',
    scale: 'tags/visualization',
    scaleX: 'tags/visualization',
    scaleY: 'tags/visualization',
    scaleZ: 'tags/visualization',
    scaleMode: 'tags/visualization',
    form: 'tags/visualization',
    formSubtype: 'tags/visualization',
    formLightIntensity: 'tags/visualization',
    formLightTarget: 'tags/visualization',
    formLightDistance: 'tags/visualization',
    formLightAngle: 'tags/visualization',
    formLightPenumbra: 'tags/visualization',
    formLightDecay: 'tags/visualization',
    formLightGroundColor: 'tags/visualization',
    formAddress: 'tags/visualization',
    formAddressAspectRatio: 'tags/visualization',
    formAnimation: 'tags/visualization',
    formAnimationAddress: 'tags/visualization',
    formOpacity: 'tags/visualization',
    formRenderOrder: 'tags/visualization',
    formDepthTest: 'tags/visualization',
    formDepthWrite: 'tags/visualization',
    formBuildStep: 'tags/visualization',
    formLDrawPartsAddress: 'tags/visualization',
    formMapLOD: 'tags/visualization',
    formMapProvider: 'tags/visualization',
    formMapTilerAPIKey: 'tags/visualization',
    formMapHeightProvider: 'tags/visualization',
    formMapHeightProviderAPIKey: 'tags/visualization',
    formMapHeightOffset: 'tags/visualization',
    formInputMultiline: 'tags/visualization',
    gltfVersion: 'tags/visualization',
    progressBar: 'tags/visualization',
    progressBarColor: 'tags/visualization',
    progressBarBackgroundColor: 'tags/visualization',
    progressBarPosition: 'tags/visualization',
    anchorPoint: 'tags/visualization',
    orientationMode: 'tags/visualization',
    maxLODThreshold: 'tags/visualization',
    minLODThreshold: 'tags/visualization',
    transformer: 'tags/visualization',
    menuItemStyle: 'tags/visualization',
    menuItemLabelStyle: 'tags/visualization',
    menuItemHoverMode: 'tags/visualization',
    menuItemText: 'tags/visualization',
    menuItemShowSubmitWhenEmpty: 'tags/visualization',
    //dimension
    '[dimension]': 'tags/dimension',
    '[dimension]SortOrder': 'tags/dimension',
    '[dimension]Position': 'tags/dimension',
    '[dimension]X': 'tags/dimension',
    '[dimension]Z': 'tags/dimension',
    '[dimension]Y': 'tags/dimension',
    '[dimension]Rotation': 'tags/dimension',
    '[dimension]RotationX': 'tags/dimension',
    '[dimension]RotationY': 'tags/dimension',
    '[dimension]RotationZ': 'tags/dimension',
    '[dimension]Start': 'tags/dimension',
    '[dimension]End': 'tags/dimension',
    //portal
    portalColor: 'tags/portal-bot',
    portalCursor: 'tags/portal-bot',
    portalCursorHotspot: 'tags/portal-bot',
    portalBackgroundAddress: 'tags/portal-bot',
    portalHDRAddress: 'tags/portal-bot',
    defaultLighting: 'tags/portal-bot',
    portalLocked: 'tags/portal-bot',
    portalPannable: 'tags/portal-bot',
    portalPannableMin: 'tags/portal-bot',
    portalPannableMax: 'tags/portal-bot',
    portalRotatable: 'tags/portal-bot',
    portalCameraRotation: 'tags/portal-bot',
    portalZoomable: 'tags/portal-bot',
    portalZoomableMin: 'tags/portal-bot',
    portalZoomableMax: 'tags/portal-bot',
    portalCameraZoom: 'tags/portal-bot',
    portalGridScale: 'tags/portal-bot',
    portalSurfaceScale: 'tags/portal-bot',
    portalCameraControls: 'tags/portal-bot',
    portalShowFocusPoint: 'tags/portal-bot',
    portalCameraType: 'tags/portal-bot',
    portalDisableCanvasTransparency: 'tags/portal-bot',
    miniPortalHeight: 'tags/portal-bot',
    miniPortalWidth: 'tags/portal-bot',
    miniPortalResizable: 'tags/portal-bot',
    mapPortalBasemap: 'tags/portal-bot',
    wristPortalHeight: 'tags/portal-bot',
    wristPortalWidth: 'tags/portal-bot',
    meetPortalVisible: 'tags/portal-bot',
    meetPortalAnchorPoint: 'tags/portal-bot',
    meetPortalStyle: 'tags/portal-bot',
    meetPortalPrejoinEnabled: 'tags/portal-bot',
    meetPortalStartWithVideoMuted: 'tags/portal-bot',
    meetPortalStartWithAudioMuted: 'tags/portal-bot',
    meetPortalRequireDisplayName: 'tags/portal-bot',
    meetPortalDisablePrivateMessages: 'tags/portal-bot',
    meetPortalLanguage: 'tags/portal-bot',
    meetPortalJWT: 'tags/portal-bot',
    botPortalAnchorPoint: 'tags/portal-bot',
    botPortalStyle: 'tags/portal-bot',
    tagPortalAnchorPoint: 'tags/portal-bot',
    tagPortalStyle: 'tags/portal-bot',
    tagPortalShowButton: 'tags/portal-bot',
    tagPortalButtonIcon: 'tags/portal-bot',
    tagPortalButtonHint: 'tags/portal-bot',
    menuPortalStyle: 'tags/portal-bot',
    sheetPortalShowButton: 'tags/portal-bot',
    sheetPortalButtonIcon: 'tags/portal-bot',
    sheetPortalButtonHint: 'tags/portal-bot',
    sheetPortalAllowedTags: 'tags/portal-bot',
    sheetPortalAddedTags: 'tags/portal-bot',
    pixelWidth: 'tags/portal-bot',
    pixelHeight: 'tags/portal-bot',
    pixelRatio: 'tags/portal-bot',
    defaultPixelRatio: 'tags/portal-bot',
    pointerPixel: 'tags/portal-bot',
    cameraPosition: 'tags/portal-bot',
    cameraPositionOffset: 'tags/portal-bot',
    cameraRotation: 'tags/portal-bot',
    cameraRotationOffset: 'tags/portal-bot',
    cameraZoom: 'tags/portal-bot',
    cameraZoomOffset: 'tags/portal-bot',
    cameraFocus: 'tags/portal-bot',
    imuSupported: 'tags/portal-bot',
    deviceRotation: 'tags/portal-bot',
    //history
    history: 'tags/history',
    markHash: 'tags/history',
    previousMarkHash: 'tags/history',
    markTime: 'tags/history',
    //config-bot
    bios: 'tags/config-bot',
    inst: 'tags/config-bot',
    staticInst: 'tags/config-bot',
    joinCode: 'tags/config-bot',
    record: 'tags/config-bot',
    owner: 'tags/config-bot',
    theme: 'tags/config-bot',
    gridPortal: 'tags/config-bot',
    miniGridPortal: 'tags/config-bot',
    sheetPortal: 'tags/config-bot',
    systemPortal: 'tags/config-bot',
    systemTagName: 'tags/config-bot',
    systemPortalBot: 'tags/config-bot',
    systemPortalTag: 'tags/config-bot',
    systemPortalTagSpace: 'tags/config-bot',
    systemPortalSearch: 'tags/config-bot',
    systemPortalDiff: 'tags/config-bot',
    systemPortalDiffBot: 'tags/config-bot',
    systemPortalDiffTag: 'tags/config-bot',
    systemPortalDiffTagSpace: 'tags/config-bot',
    systemPortalPanel: 'tags/config-bot',
    idePortal: 'tags/config-bot',
    mapPortal: 'tags/config-bot',
    miniMapPortal: 'tags/config-bot',
    menuPortal: 'tags/config-bot',
    leftWristPortal: 'tags/config-bot',
    rightWristPortal: 'tags/config-bot',
    meetPortal: 'tags/config-bot',
    botPortal: 'tags/config-bot',
    tagPortal: 'tags/config-bot',
    tagPortalSpace: 'tags/config-bot',
    codeToolsPortal: 'tags/config-bot',
    imuPortal: 'tags/config-bot',
    dataPortal: 'tags/config-bot',
    mousePointerPosition: 'tags/config-bot',
    mousePointerRotation: 'tags/config-bot',
    mousePointerPortal: 'tags/config-bot',
    leftPointerPosition: 'tags/config-bot',
    leftPointerRotation: 'tags/config-bot',
    leftPointerPortal: 'tags/config-bot',
    rightPointerPosition: 'tags/config-bot',
    rightPointerRotation: 'tags/config-bot',
    rightPointerPortal: 'tags/config-bot',
    mousePointer_left: 'tags/config-bot',
    mousePointer_right: 'tags/config-bot',
    mousePointer_middle: 'tags/config-bot',
    rightPointer_primary: 'tags/config-bot',
    rightPointer_squeeze: 'tags/config-bot',
    leftPointer_primary: 'tags/config-bot',
    leftPointer_squeeze: 'tags/config-bot',
    'keyboard_[key]': 'tags/config-bot',
    'touch_[index]': 'tags/config-bot',
    forceSignedScripts: 'tags/config-bot',
    url: 'tags/config-bot',
    permalink: 'tags/config-bot',
    pageTitle: 'tags/config-bot',
    editingBot: 'tags/config-bot',
    editingTag: 'tags/config-bot',
    cursorStartIndex: 'tags/config-bot',
    cursorEndIndex: 'tags/config-bot',
    //auth-tags
    avatarAddress: 'tags/auth-bot',
    name: 'tags/auth-bot',
    hasActiveSubscription: 'tags/auth-bot',
    subscriptionTier: 'tags/auth-bot',
    privacyFeatures: 'tags/auth-bot',
};

function relativeLink(path) {
    return useBaseUrl(path);
}

export const ListenTagLink = ({tag}) => (
  <a href={relativeLink('tags/listen') + '#' + tag.replace(/[\.\(\)\@\[\]]/g, '').toLowerCase()}>
    <NormalCode>{tag}</NormalCode>
  </a>
);

export const TypeLink = ({type, children}) => {
    let c = <NormalCode>{children ?? type}</NormalCode>;
    const hash = Info.references?.[type];
    if (!hash) {
        console.warn('No hash for type', action);
        return c;
    }
    const url = relativeLink(hash) + '#' + type;
    return <a href={url}>{c}</a>;
}

export const ActionLink = ({action, children}) => {
    let id = null;
    let parametersStart = action.indexOf('(');
    if (parametersStart >= 0) {
        id = action.substring(0, parametersStart);
    } else {
        id = action;
        action += '()';
    }
    let c = <NormalCode>{children ?? action}</NormalCode>;
    const hash = Info.references[id];
    if (!hash) {
        console.warn('No hash for action', action);
        return c;
    }
    const url = relativeLink(hash) + '#' + id;
    return <a href={url}>{c}</a>;
}

{/* <!-- (
  <a href={useBaseUrl('actions') + '#' + action.replace(/[\.\(\)\,\?]/g, '').replace(/\s/g, '-').toLowerCase()}>
  {children ? children : (
      <NormalCode>{action}</NormalCode>
  )}
  </a>
); --> */}

export const NormalCode = ({children}) => (
  React.createElement('code', {}, ...children)
);

export const LabelAnchorValues = ({}) => (<React.Fragment>
  <PossibleValueCode value='top'>
    Top of the bot facing world oriented up. (default)
  </PossibleValueCode>
  <PossibleValueCode value='front'>
    Front of the bot facing world oriented forward.
  </PossibleValueCode>
  <PossibleValueCode value='back'>
    Back of the bot facing world oriented back.
  </PossibleValueCode>
  <PossibleValueCode value='right'>
    Right of the bot facing world oriented right.
  </PossibleValueCode>
  <PossibleValueCode value='left'>
     Left of the bot facing world oriented left.
  </PossibleValueCode>
  <PossibleValueCode value='floating'>
     Floating above the bot.
  </PossibleValueCode>
  <PossibleValueCode value='floatingBillboard'>
     Floating above the bot and billboarded to face the camera.
     Like floating, but the label background won't have an arrow and the label will always face the camera.
  </PossibleValueCode>
</React.Fragment>)

export const Badges = ({children}) => (
  <div className='row badge-row'>
    <div className='col'>
      {children}
    </div>
  </div>
);


export const VariableLink = ({name, children, ...attrs}) => (
    <a href={relativeLink('variables') + '#' + name.replace(/[\.\(\)\@\[\]]/g, '').toLowerCase()} {...attrs}>
        {children ? children : (<NormalCode>{name}</NormalCode>)}
    </a>
);

export const Badge = ({type, title, children}) => (<span title={title} className={`badge badge--${type}`}>{children}</span>);

export const ReadOnlyBadge = ({}) => (<Badge type='warning'>Read-Only</Badge>);

export const VideoBadge = ({url}) => (<Badge type='info'><a href={url} target='_blank'>Video</a></Badge>);

export const ConfigBotBadge = ({url}) => (<Badge type='primary'>Config Bot</Badge>);
export const UrlSyncBadge = ({url}) => (<Badge>Synced to URL</Badge>);

export const HistoryBotBadge = ({url}) => (<Badge type='primary'>History Bot</Badge>);

export const AutomaticBadge = ({url}) => (<Badge type='success' title='This tag is automatically set by CasualOS.'>Automatic</Badge>);

export const PortalBadge = ({bot}) => (<VariableLink name={bot} className="portal-badge">
    <Badge type='normal' title={`This tag is available on the ${bot}.`}>{bot}</Badge>
</VariableLink>);

export const GridPortalBadge = ({url}) => <PortalBadge bot="gridPortalBot"/>;
export const MiniGridPortalBadge = ({url}) => <PortalBadge bot="miniGridPortalBot"/>;
export const MiniMapPortalBadge = ({url}) => <PortalBadge bot="miniMapPortalBot"/>;
export const MapPortalBadge = ({url}) => <PortalBadge bot="mapPortalBot"/>;
export const MenuPortalBadge = ({url}) => <PortalBadge bot="menuPortalBot"/>;
export const MeetPortalBadge = ({url}) => <PortalBadge bot="meetPortalBot"/>;
export const LeftWristPortalBadge = ({url}) => <PortalBadge bot="leftWristPortalBot"/>;
export const RightWristPortalBadge = ({url}) => <PortalBadge bot="rightWristPortalBot"/>;
export const SheetPortalBadge = ({url}) => <PortalBadge bot="sheetPortalBot"/>;
export const BotPortalBadge = ({url}) => <PortalBadge bot="botPortalBot"/>;
export const TagPortalBadge = ({url}) => <PortalBadge bot="tagPortalBot"/>;
export const ImuPortalBadge = ({url}) => <PortalBadge bot="imuPortalBot"/>;

export const Alert = ({type, children}) => (
    <div className={`alert alert--${type}`} role='alert'>
        {children}
    </div>
);

export const Example = ({code}) => (<Badge type='info'><a target='_blank' href={`https://casualos.com?auxCode=${code}`}>Example</a></Badge>);

export const ExampleIframe = ({ code }) => (<iframe className="example" src={`https://casualos.com?auxCode=${code}`}></iframe>);
