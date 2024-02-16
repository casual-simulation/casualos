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

export const DataTagLink = ({tag}) => (
  <a href={useBaseUrl(tagMap[tag]) + '#' + tag.replace(/[\.\(\)\@\[\]]/g, '').toLowerCase()}>
    <NormalCode>#{tag}</NormalCode>
  </a>
);
export const tagMap = {
    //tag-types
    boolean: 'tag-types',
    number: 'tag-types',
    string: 'tag-types',
    mod: 'tag-types',
    date: 'tag-types',
    vector: 'tag-types',
    rotation: 'tag-types',
    script: 'tag-types',
    //info-tags
    id: 'info-tags',
    space: 'info-tags',
    creator: 'info-tags',
    //behavior-tags
    draggable: 'behavior-tags',
    pointable: 'behavior-tags',
    focusable: 'behavior-tags',
    destroyable: 'behavior-tags',
    editable: 'behavior-tags',
    listening: 'behavior-tags',
    system: 'behavior-tags',
    //visualization-tags
    color: 'visualization-tags',
    cursor: 'visualization-tags',
    cursorHotspot: 'visualization-tags',
    strokeColor: 'visualization-tags',
    strokeWidth: 'visualization-tags',
    lineTo: 'visualization-tags',
    lineStyle: 'visualization-tags',
    lineWidth: 'visualization-tags',
    lineColor: 'visualization-tags',
    label: 'visualization-tags',
    labelColor: 'visualization-tags',
    labelOpacity: 'visualization-tags',
    labelFontSize: 'visualization-tags',
    labelPadding: 'visualization-tags',
    labelPaddingX: 'visualization-tags',
    labelPaddingY: 'visualization-tags',
    labelSize: 'visualization-tags',
    labelSizeMode: 'visualization-tags',
    labelPosition: 'visualization-tags',
    labelAlignment: 'visualization-tags',
    labelFontAddress: 'visualization-tags',
    labelWordWrapMode: 'visualization-tags',
    scale: 'visualization-tags',
    scaleX: 'visualization-tags',
    scaleY: 'visualization-tags',
    scaleZ: 'visualization-tags',
    scaleMode: 'visualization-tags',
    form: 'visualization-tags',
    formSubtype: 'visualization-tags',
    formLightIntensity: 'visualization-tags',
    formLightTarget: 'visualization-tags',
    formLightDistance: 'visualization-tags',
    formLightAngle: 'visualization-tags',
    formLightPenumbra: 'visualization-tags',
    formLightDecay: 'visualization-tags',
    formLightGroundColor: 'visualization-tags',
    formAddress: 'visualization-tags',
    formAddressAspectRatio: 'visualization-tags',
    formAnimation: 'visualization-tags',
    formAnimationAddress: 'visualization-tags',
    formOpacity: 'visualization-tags',
    formRenderOrder: 'visualization-tags',
    formDepthTest: 'visualization-tags',
    formDepthWrite: 'visualization-tags',
    gltfVersion: 'visualization-tags',
    progressBar: 'visualization-tags',
    progressBarColor: 'visualization-tags',
    progressBarBackgroundColor: 'visualization-tags',
    progressBarPosition: 'visualization-tags',
    anchorPoint: 'visualization-tags',
    orientationMode: 'visualization-tags',
    maxLODThreshold: 'visualization-tags',
    minLODThreshold: 'visualization-tags',
    transformer: 'visualization-tags',
    menuItemStyle: 'visualization-tags',
    menuItemLabelStyle: 'visualization-tags',
    menuItemHoverMode: 'visualization-tags',
    menuItemText: 'visualization-tags',
    menuItemShowSubmitWhenEmpty: 'visualization-tags',
    //dimension-tags
    dimension: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionSortOrder: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionPosition: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionX: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionY: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionZ: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionRotation: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionRotationX: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionRotationY: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionRotationZ: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionStart: 'dimension-tags', //DOUBLE CHECK THIS
    dimensionEnd: 'dimension-tags', //DOUBLE CHECK THIS
    //portal-bot-tags
    portalColor: 'portal-bot-tags',
    portalCursor: 'portal-bot-tags',
    portalCursorHotspot: 'portal-bot-tags',
    portalBackgroundAddress: 'portal-bot-tags',
    portalHDRAddress: 'portal-bot-tags',
    defaultLighting: 'portal-bot-tags',
    portalLocked: 'portal-bot-tags',
    portalPannable: 'portal-bot-tags',
    portalPannableMin: 'portal-bot-tags',
    portalPannableMax: 'portal-bot-tags',
    portalRotatable: 'portal-bot-tags',
    portalCameraRotation: 'portal-bot-tags',
    portalZoomable: 'portal-bot-tags',
    portalZoomableMin: 'portal-bot-tags',
    portalZoomableMax: 'portal-bot-tags',
    portalCameraZoom: 'portal-bot-tags',
    portalGridScale: 'portal-bot-tags',
    portalSurfaceScale: 'portal-bot-tags',
    portalCameraControls: 'portal-bot-tags',
    portalShowFocusPoint: 'portal-bot-tags',
    portalCameraType: 'portal-bot-tags',
    portalDisableCanvasTransparency: 'portal-bot-tags',
    miniPortalHeight: 'portal-bot-tags',
    miniPortalWidth: 'portal-bot-tags',
    miniPortalResizable: 'portal-bot-tags',
    mapPortalBasemap: 'portal-bot-tags',
    wristPortalHeight: 'portal-bot-tags',
    wristPortalWidth: 'portal-bot-tags',
    meetPortalVisible: 'portal-bot-tags',
    meetPortalAnchorPoint: 'portal-bot-tags',
    meetPortalStyle: 'portal-bot-tags',
    meetPortalPrejoinEnabled: 'portal-bot-tags',
    meetPortalStartWithVideoMuted: 'portal-bot-tags',
    meetPortalStartWithAudioMuted: 'portal-bot-tags',
    meetPortalRequireDisplayName: 'portal-bot-tags',
    meetPortalDisablePrivateMessages: 'portal-bot-tags',
    meetPortalLanguage: 'portal-bot-tags',
    meetPortalJWT: 'portal-bot-tags',
    botPortalAnchorPoint: 'portal-bot-tags',
    botPortalStyle: 'portal-bot-tags',
    tagPortalAnchorPoint: 'portal-bot-tags',
    tagPortalStyle: 'portal-bot-tags',
    tagPortalShowButton: 'portal-bot-tags',
    tagPortalButtonIcon: 'portal-bot-tags',
    tagPortalButtonHint: 'portal-bot-tags',
    menuPortalStyle: 'portal-bot-tags',
    sheetPortalShowButton: 'portal-bot-tags',
    sheetPortalButtonIcon: 'portal-bot-tags',
    sheetPortalButtonHint: 'portal-bot-tags',
    sheetPortalAllowedTags: 'portal-bot-tags',
    sheetPortalAddedTags: 'portal-bot-tags',
    pixelWidth: 'portal-bot-tags',
    pixelHeight: 'portal-bot-tags',
    pixelRatio: 'portal-bot-tags',
    defaultPixelRatio: 'portal-bot-tags',
    pointerPixel: 'portal-bot-tags',
    cameraPosition: 'portal-bot-tags',
    cameraPositionOffset: 'portal-bot-tags',
    cameraRotation: 'portal-bot-tags',
    cameraRotationOffset: 'portal-bot-tags',
    cameraZoom: 'portal-bot-tags',
    cameraZoomOffset: 'portal-bot-tags',
    cameraFocus: 'portal-bot-tags',
    imuSupported: 'portal-bot-tags',
    deviceRotation: 'portal-bot-tags',
    //history-tags
    history: 'history-tags',
    markHash: 'history-tags',
    previousMarkHash: 'history-tags',
    markTime: 'history-tags',
    //config-bot-tags
    bios: 'config-bot-tags',
    inst: 'config-bot-tags',
    staticInst: 'config-bot-tags',
    joinCode: 'config-bot-tags',
    record: 'config-bot-tags',
    owner: 'config-bot-tags',
    theme: 'config-bot-tags',
    gridPortal: 'config-bot-tags',
    miniGridPortal: 'config-bot-tags',
    sheetPortal: 'config-bot-tags',
    systemPortal: 'config-bot-tags',
    systemTagName: 'config-bot-tags',
    systemPortalBot: 'config-bot-tags',
    systemPortalTag: 'config-bot-tags',
    systemPortalTagSpace: 'config-bot-tags',
    systemPortalSearch: 'config-bot-tags',
    systemPortalDiff: 'config-bot-tags',
    systemPortalDiffBot: 'config-bot-tags',
    systemPortalDiffTag: 'config-bot-tags',
    systemPortalDiffTagSpace: 'config-bot-tags',
    systemPortalPanel: 'config-bot-tags',
    idePortal: 'config-bot-tags',
    mapPortal: 'config-bot-tags',
    miniMapPortal: 'config-bot-tags',
    menuPortal: 'config-bot-tags',
    leftWristPortal: 'config-bot-tags',
    rightWristPortal: 'config-bot-tags',
    meetPortal: 'config-bot-tags',
    botPortal: 'config-bot-tags',
    tagPortal: 'config-bot-tags',
    tagPortalSpace: 'config-bot-tags',
    codeToolsPortal: 'config-bot-tags',
    imuPortal: 'config-bot-tags',
    dataPortal: 'config-bot-tags',
    mousePointerPosition: 'config-bot-tags',
    mousePointerRotation: 'config-bot-tags',
    mousePointerPortal: 'config-bot-tags',
    leftPointerPosition: 'config-bot-tags',
    leftPointerRotation: 'config-bot-tags',
    leftPointerPortal: 'config-bot-tags',
    rightPointerPosition: 'config-bot-tags',
    rightPointerRotation: 'config-bot-tags',
    rightPointerPortal: 'config-bot-tags',
    mousePointer_left: 'config-bot-tags',
    mousePointer_right: 'config-bot-tags',
    mousePointer_middle: 'config-bot-tags',
    rightPointer_primary: 'config-bot-tags',
    rightPointer_squeeze: 'config-bot-tags',
    leftPointer_primary: 'config-bot-tags',
    leftPointer_squeeze: 'config-bot-tags',
    keyboard_key: 'config-bot-tags', //DOUBEL CHECK THIS
    touch_index: 'config-bot-tags', //DOUBEL CHECK THIS
    forceSignedScripts: 'config-bot-tags',
    url: 'config-bot-tags',
    permalink: 'config-bot-tags',
    pageTitle: 'config-bot-tags',
    editingBot: 'config-bot-tags',
    editingTag: 'config-bot-tags',
    cursorStartIndex: 'config-bot-tags',
    cursorEndIndex: 'config-bot-tags',
    //auth-bot-tags
    avatarAddress: 'auth-bot-tags',
    name: 'auth-bot-tags',
    hasActiveSubscription: 'auth-bot-tags',
    subscriptionTier: 'auth-bot-tags',
    privacyFeatures: 'auth-bot-tags',
};

const page = tagMap['id'];

export const ListenTagLink = ({tag}) => (
  <a href={useBaseUrl('listen-tags') + '#' + tag.replace(/[\.\(\)\@\[\]]/g, '').toLowerCase()}>
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
    const url = useBaseUrl(hash) + '#' + type;
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
    const url = useBaseUrl(hash) + '#' + id;
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
</React.Fragment>)

export const Badges = ({children}) => (
  <div className='row badge-row'>
    <div className='col'>
      {children}
    </div>
  </div>
);


export const VariableLink = ({name, children, ...attrs}) => (
    <a href={useBaseUrl('variables') + '#' + name.replace(/[\.\(\)\@\[\]]/g, '').toLowerCase()} {...attrs}>
        {children ? children : (<NormalCode>{name}</NormalCode>)}
    </a>
);

export const Badge = ({type, title, children}) => (<span title={title} className={`badge badge--${type}`}>{children}</span>);

export const ReadOnlyBadge = ({}) => (<Badge type='warning'>Read-Only</Badge>);

export const VideoBadge = ({url}) => (<Badge type='info'><a href={url} target='_blank'>Video</a></Badge>);

export const ConfigBotBadge = ({url}) => (<Badge type='primary'>Config Bot</Badge>);

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
