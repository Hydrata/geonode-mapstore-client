import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import { Glyphicon, Table, Button, ProgressBar, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Dropzone from 'react-dropzone';
import {
    setVisibleUploaderPanel,
    updateUploadStatus
} from "../actionsSimpleView";
import '../simpleView.css';
import {DateFormat} from "../../../../../MapStore2/web/client/components/I18N/I18N";
import axios from "../../../../../MapStore2/web/client/libs/ajax";

class simpleViewUploaderPanel extends React.Component {
    static propTypes = {
        setVisibleUploaderPanel: PropTypes.func,
        updateUploaderFile: PropTypes.func,
        setUploaderFiles: PropTypes.func,
        uploaderFiles: PropTypes.object,
        updateUploadStatus: PropTypes.func,
        uploadStatus: PropTypes.string,
        visibleUploaderPanel: PropTypes.bool,
        serverUrl: PropTypes.string,
        projectId: PropTypes.number,
        newTitle: PropTypes.string,
        fileType: PropTypes.string
    };

    constructor(props) {
        super(props);
        this.state = {
            uploaderFiles: [],
            newTitle: ''
        };
        this.beginTooltip = React.createRef();
    }

    render() {
        return this.props.visibleUploaderPanel ?
            <div className={'simple-view-panel uploader-panel'}>
                <div className={"row h4 legend-heading"}>
                    Upload File
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => this.props.setVisibleUploaderPanel(false)}
                    />
                </div>
                {this.state.uploaderFiles.length > 0 ?
                    <Table bordered condensed hover ref={this.beginTooltip} style={{'tableLayout': 'fixed'}}>
                        <thead>
                            <tr>
                                <th width="155px" key="hname">Title</th>
                                <th width="80px" key="hname">Filename</th>
                                <th width="80px" key="hsize">Filesize</th>
                                <th width="80px" key="htype">Filetype</th>
                                <th width="80px" key="hlast">Modified</th>
                                <th width="80px" key="hstatus">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {this.state.uploaderFiles && this.state.uploaderFiles.map((file, index) =>
                                (<tr key={"row_" + index}>
                                    <td key="title">
                                        <input
                                            id={'newTitle'}
                                            key={'newTitle'}
                                            className={'data-title-input'}
                                            type={'text'}
                                            value={this.state.newTitle}
                                            onChange={(e) => this.setState({newTitle: e.target.value})}
                                        />
                                    </td>
                                    <td key="name">{file.name}</td>
                                    <td key="size">{this.humanFileSize(file.size)}</td>
                                    <td key="type">{file.type}</td>
                                    <td key="last"><DateFormat value={file.lastModifiedDate} /></td>
                                    <td key="status">
                                        {
                                            file.status === "begin" ?
                                                <OverlayTrigger positionLeft overlay={<Tooltip>Enter a title</Tooltip>}>
                                                    <Button
                                                        onClick={() => this.uploadFile(file, this.props.fileType || 'file')}
                                                        className={this.state.newTitle ? '' : 'disabled'}
                                                        style={{'borderRadius': '3px'}}
                                                        bsSize={'small'}
                                                        bsStyle={'success'}
                                                    >
                                                        Begin
                                                    </Button>
                                                </OverlayTrigger> :
                                                <ProgressBar active bsStyle={"info"} now={this.props.uploadStatus}>
                                                    {this.props.uploadStatus === 100 ? 'importing...' : this.props.uploadStatus + '%'}
                                                </ProgressBar>
                                        }
                                    </td>
                                </tr>) )
                            }
                        </tbody>
                    </Table> :
                    <Dropzone
                        key="dropzone"
                        rejectClassName="alert-danger"
                        className="alert alert-info"
                        onDrop={(files) => this.setState({
                            uploaderFiles: files.map((file) => {
                                Object.defineProperty(file, 'status', {
                                    value: "begin",
                                    writable: true
                                });
                                return file;
                            })
                        })}
                        style={this.props.dropZoneStyle}
                        activeStyle={this.props.dropZoneActiveStyle}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            height: "100%",
                            justifyContent: "center"
                        }}>
                            <span style={{
                                width: "100px",
                                height: "100px",
                                textAlign: "center"
                            }}>
                                <Glyphicon glyph="upload"/><br/>
                                Drag files or<br/>click here
                            </span>
                        </div>
                    </Dropzone>
                }
            </div> :
            null;
    }

    humanFileSize = (size) => {
        const i = Math.floor( Math.log(size) / Math.log(1024) );
        return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
    };
    uploadFile = (file, fileType) => {
        console.log('uploadFile started', file);
        this.setState(prevState => ({
            itemList: prevState.uploaderFiles.map(
                fileToCheck => (fileToCheck.preview === file.preview ? Object.assign(fileToCheck, { status: "uploading" }) : fileToCheck)
            )
        }));
        const data = new FormData();
        data.append(fileType, file);
        data.append('title', this.state.newTitle);
        let url;
        if (this.props.serverUrl.includes('localhost')) {
            url = 'http://localhost:8081/';
        } else {
            url = this.props.serverUrl;
        }
        axios
            .put(`${url}anuga/api/${this.props.projectId}/elevation/upload/`, data, this.uploadConfig)
            .then(response => {
                console.log('upload response', response);
                this.setState(prevState => ({
                    itemList: prevState.uploaderFiles.map(
                        fileToCheck => (fileToCheck.preview === file.preview ? Object.assign(fileToCheck, { status: "complete" }) : fileToCheck)
                    )
                }));
            });
    };
    uploadConfig = {
        onUploadProgress: (progressEvent) => {
            let status = Math.round( (progressEvent.loaded * 100) / progressEvent.total);
            this.props.updateUploadStatus(status);
        }
    };
}

const mapStateToProps = (state) => {
    return {
        visibleUploaderPanel: state?.simpleView?.visibleUploaderPanel,
        serverUrl: state?.gnsettings?.geonodeUrl,
        projectId: state?.anuga?.project?.id,
        uploadStatus: state?.simpleView?.uploadStatus
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleUploaderPanel: (visible) => dispatch(setVisibleUploaderPanel(visible)),
        updateUploadStatus: (status) => dispatch(updateUploadStatus(status))
    };
};

export const UploaderPanel = connect(mapStateToProps, mapDispatchToProps)(simpleViewUploaderPanel);
