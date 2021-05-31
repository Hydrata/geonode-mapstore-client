/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useRef, useState, useEffect } from 'react';
import { Button, Spinner, Tooltip, OverlayTrigger } from 'react-bootstrap-v1';
import DOMPurify from 'dompurify';
import FaIcon from '@js/components/home/FaIcon';
import Message from '@mapstore/framework/components/I18N/Message';
import moment from 'moment';
import {
    getUserName,
    getResourceTypesInfo
} from '@js/utils/GNSearchUtils';

import CopyToClipboard from 'react-copy-to-clipboard';
import url from 'url';
import {TextEditable, ThumbnailEditable} from '@js/components/ContentsEditable/';

const EditTitle = ({title, onEdit}) => {
    return (
        <div className="editContainer">
            <h1><TextEditable  onEdit={ onEdit } text={title} /></h1>
        </div>);
};

const EditAbstract = ({abstract, onEdit}) => (
    <div className="editContainer">
        <TextEditable onEdit={ onEdit } text={abstract} />
    </div>

);


const EditThumbnail = ({image, onEdit}) => (
    <div className="editContainer imagepreview">
        <ThumbnailEditable onEdit={onEdit} defaultImage={image} />
    </div>

);


function formatResourceLinkUrl(resourceUrl = '') {
    if (resourceUrl.indexOf('http') === 0) {
        return resourceUrl;
    }
    const { path } = url.parse(resourceUrl);
    const { protocol, host } = window.location;
    return `${protocol}://${host}${path}`;
}

function ThumbnailPreview({
    src,
    style,
    ...props
}) {

    const [loading, setLoading] = useState();

    useEffect(() => {
        if (src && !loading) {
            setLoading(true);
        }
    }, [src]);

    return (
        <img
            {...props}
            src={src}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            style={{
                ...style,
                ...(loading && {
                    backgroundColor: 'transparent'
                }),
                objectFit: 'contain'
            }}
        />
    );
}

function DetailsPanel({
    resource,
    formatHref,
    linkHref,
    sectionStyle,
    loading,
    getTypesInfo,
    editTitle,
    editAbstract,
    editThumbnail,
    activeEditMode,
    closePanel
}) {


    const [editModeTitle, setEditModeTitle] = useState(false);
    const [editModeAbstract, setEditModeAbstract] = useState(false);

    const handleEditModeTitle = () => {
        setEditModeTitle(!editModeTitle);
    };

    const handleEditModeAbstract = () => {
        setEditModeAbstract(!editModeAbstract);
    };

    const detailsContainerNode = useRef();
    const isMounted = useRef();
    const [copiedResourceLink, setCopiedResourceLink] = useState(false);
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    if (!resource && !loading) {
        return null;
    }

    const handleCopyPermalink = () => {
        setCopiedResourceLink(true);
        setTimeout(() => {
            if (isMounted.current) {
                setCopiedResourceLink(false);
            }
        }, 700);
    };


    const types = getTypesInfo();
    const {
        formatEmbedUrl = res => res?.embed_url,
        formatDetailUrl = res => res?.detail_url,
        icon,
        name
    } = resource && (types[resource.doc_type] || types[resource.resource_type]) || {};
    const embedUrl = resource?.embed_url && formatEmbedUrl(resource);
    const detailUrl = resource?.pk && formatDetailUrl(resource);

    return (
        <div
            ref={detailsContainerNode}
            className={`gn-details-panel${loading ? ' loading' : ''}`}
            style={{ width: sectionStyle?.width }}
        >
            <section style={sectionStyle}>
                {<div className="gn-details-panel-header">
                    <Button
                        variant="default"
                        href={linkHref()}
                        onClick={closePanel}
                        size="sm">
                        <FaIcon name="times" />
                    </Button>
                </div>
                }
                {!activeEditMode && <div className="gn-details-panel-preview">
                    <div
                        className="gn-loader-placeholder"
                        style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                        <FaIcon name={icon}/>
                    </div>
                    {embedUrl
                        ? <iframe
                            key={embedUrl}
                            src={embedUrl}
                            style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%'
                            }}
                            frameBorder="0"
                        />
                        : (<ThumbnailPreview
                            src={resource?.thumbnail_url}
                            style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                top: 0,
                                left: 0,
                                backgroundColor: 'inherit'
                            }}/> )
                    }
                    {loading && <div
                        className="gn-details-panel-preview-loader"
                        style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            top: 0,
                            left: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                        <Spinner animation="border" role="status">
                            <span className="sr-only">Loading resource detail...</span>
                        </Spinner>
                    </div>}
                </div> }

                {activeEditMode && editThumbnail && <div className="gn-details-panel-preview inediting"> <EditThumbnail onEdit={editThumbnail} image={resource?.thumbnail_url} /> </div>}


                <div className="gn-details-panel-content">
                    <div className="gn-details-panel-title" >

                        {!editModeTitle && <h1>
                            { icon && <><FaIcon name={icon}/></>}
                            { resource?.title }
                        </h1>
                        }
                        { activeEditMode && !editModeTitle && <span className="inEdit" onClick={handleEditModeTitle} ><FaIcon name={'edit'}/></span>}


                        {editModeTitle && <><h1><EditTitle title={resource?.title} onEdit={editTitle} />
                        </h1>
                        <span className="inEdit" onClick={handleEditModeTitle} ><FaIcon name={'check-circle'}/></span></>
                        }
                        {
                            <div className="gn-details-panel-tools">
                                {detailUrl && <OverlayTrigger
                                    placement="top"
                                    overlay={(props) =>
                                        <Tooltip id="share-resource-tooltip" {...props}>
                                            <Message msgId={
                                                copiedResourceLink
                                                    ? 'gnhome.copiedResourceUrl'
                                                    : 'gnhome.copyResourceUrl'
                                            }/>
                                        </Tooltip>}
                                >
                                    <CopyToClipboard
                                        text={formatResourceLinkUrl(detailUrl)}
                                    >
                                        <Button
                                            variant="default"
                                            onClick={handleCopyPermalink}>
                                            <FaIcon name="share-alt" />
                                        </Button>
                                    </CopyToClipboard>
                                </OverlayTrigger>}
                                {detailUrl && <Button
                                    variant="default"
                                    href={detailUrl}
                                    target="_blank"
                                    rel="noopener noreferrer">
                                    <Message msgId={`gnhome.view${name || ''}`}/>
                                </Button>}
                            </div>
                        }


                    </div>


                    {<p>
                        {resource?.owner && <><a href={formatHref({
                            query: {
                                'filter{owner.username.in}': resource.owner.username
                            }
                        })}>{getUserName(resource.owner)}</a></>}
                        {(resource?.date_type && resource?.date)
                            && <>{' '}/{' '}{ moment(resource.date).format('MMMM Do YYYY')}</>}
                    </p>
                    }
                    <p>
                        { activeEditMode && !editModeAbstract && <span className="inEdit" onClick={handleEditModeAbstract} ><FaIcon name={'edit'}/></span>}
                        <div className="gn-details-panel-description">
                            {editModeAbstract && <>
                                <span className="inEdit" onClick={handleEditModeAbstract} ><FaIcon name={'check-circle'}/></span>
                                <EditAbstract abstract={resource?.abstract} onEdit={editAbstract} />
                            </>
                            }
                            {
                                !editModeAbstract && resource?.abstract ?
                                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(resource.abstract) }} />
                                    : null
                            }
                        </div>
                    </p>

                    <p>
                        {resource?.category?.identifier && <div>
                            <Message msgId="gnhome.category"/>:{' '}
                            <a href={formatHref({
                                query: {
                                    'filter{category.identifier.in}': resource.category.identifier
                                }
                            })}>{resource.category.identifier}</a>
                        </div>}
                    </p>
                </div>
            </section>
        </div>
    );
}

DetailsPanel.defaultProps = {
    onClose: () => { },
    formatHref: () => '#',
    linkHref: () => '#',
    width: 696,
    getTypesInfo: getResourceTypesInfo
};

export default DetailsPanel;
