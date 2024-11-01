import AUX from './AuxFile.mdx';
import ABCore from './abCore.mdx';
import Bot from './Bot.mdx';
import CasualOS from './CasualOS.mdx';
import Dimension from './Dimension.mdx';
import Server from './Server.mdx';
import Instance from './Instance.mdx';
import Portal from './Portal.mdx';
import Tag from './Tag.mdx';
import GridPortal from './GridPortal.mdx';
import MapPortal from './MapPortal.mdx';
import MiniGridPortal from './MiniGridPortal.mdx';
import MiniMapPortal from './MiniMapPortal.mdx';
import SheetPortal from './SheetPortal.mdx';
import SystemPortal from './SystemPortal.mdx';
import TagPortal from './TagPortal.mdx';
import Record from './Record.mdx';
import RecordKey from './RecordKey.mdx';
import FileRecord from './FileRecord.mdx';
import DataRecord from './DataRecord.mdx';
import EventRecord from './EventRecord.mdx';
import ManualApprovalDataRecord from './ManualApprovalDataRecord.mdx';
import ImageClassification from './ImageClassification.mdx';
import WebhookRecord from './WebhookRecord.mdx';
import React, { useState } from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Tooltip from 'rc-tooltip';

import 'rc-tooltip/assets/bootstrap.css';

function relativeLink(path) {
    return new URL(path, import.meta.url).href;
}

export const Glossary = [
    { id: 'aux', title: 'AUX', content: () => <AUX/> },
    { id: 'abCore', title: 'abCore', content: () => <AB1/> },
    { id: 'bot', title: 'Bot', content: () => <Bot/> },
    { id: 'casualos', title: 'CasualOS', content: () => <CasualOS/> },
    { id: 'dimension', title: 'Dimension', content: () => <Dimension/> },
    { id: 'instance', title: 'Instance', content: () => <Instance/> },
    { id: 'portal', title: 'Portal', content: () => <Portal/> },
    { id: 'tag', title: 'Tag', content: () => <Tag/> },
    { id: 'gridPortal', title: 'gridPortal', content: () => <GridPortal/> },
    { id: 'image-classification', title: 'Image Classification', content: () => <ImageClassification/> },
    { id: 'mapPortal', title: 'mapPortal', content: () => <MapPortal/> },
    { id: 'miniGridPortal', title: 'miniGridPortal', content: () => <MiniGridPortal/> },
    { id: 'miniMapPortal', title: 'miniMapPortal', content: () => <MiniMapPortal/> },
    { id: 'server', title: 'Server', content: () => <Server/> },
    { id: 'sheetPortal', title: 'sheetPortal', content: () => <SheetPortal/> },
    { id: 'systemPortal', title: 'systemPortal', content: () => <SystemPortal/> },
    { id: 'tagPortal', title: 'tagPortal', content: () => <TagPortal/> },
    { id: 'record', title: 'Record', content: () => <Record/> },
    { id: 'record-key', title: 'Record Key', content: () => <RecordKey/> },
    { id: 'file-record', title: 'File Record', content: () => <FileRecord/> },
    { id: 'data-record', title: 'Data Record', content: () => <DataRecord/> },
    { id: 'event-record', title: 'Event Record', content: () => <EventRecord/> },
    { id: 'manual-approval-data-record', title: 'Manual Approval Data Record', content: () => <ManualApprovalDataRecord/> },
    { id: 'webhook-record', title: 'Webhook Record', content: () => <WebhookRecord/> }
];

const GlossaryWindow = ({item}) => (<div className="glossary-window">
    <h4 className="glossary-title">{item.title}</h4>
    <div className="glossary-content">{item.content()}</div>
</div>);

export const GlossaryRef = ({term, children}) => {
    const item = Glossary.find(i => i.id === term);
    if (!item) {
        throw new Error('Cannot find glossary item ' + term);
    }
    return (
        <Tooltip placement="top" overlay={<GlossaryWindow item={item}/>}>
            <a href={relativeLink('glossary') + `#${item.id.replace(/[\.\(\)\@\[\]]/g, '').toLowerCase()}`}>{children}</a>
        </Tooltip>
    )
};

export {
    AUX,
    ABCore,
    Bot,
    CasualOS,
    Dimension,
    Instance,
    Portal,
    Tag,
    GridPortal,
    MapPortal,
    MiniGridPortal,
    MiniMapPortal,
    Server,
    SheetPortal,
    SystemPortal,
    TagPortal,
    Record,
    RecordKey,
    FileRecord,
    DataRecord,
    EventRecord,
    ManualApprovalDataRecord,
    ImageClassification,
    WebhookRecord
};