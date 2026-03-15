import React from 'react';
import { connect } from 'react-redux';
import {
    hideBmpChooser,
    getBmpFormSuccess,
    makeExistingBmpForm,
    setUpdatingBmp,
    showBmpForm
} from '../../actionsSwamm';

const BmpChooserModal = ({ candidates, onSelect, onClose }) => {
    if (!candidates || candidates.length === 0) return null;

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1030,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}
        onClick={onClose}
        >
            <div
                className="simple-view-panel"
                style={{
                    minWidth: 320,
                    maxWidth: 500,
                    padding: 0,
                    backgroundColor: '#063167'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="simple-view-panel-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px'
                }}>
                    <span>Select a BMP</span>
                    <span
                        className="btn glyphicon glyphicon-remove legend-close"
                        onClick={onClose}
                    />
                </div>
                <div style={{ padding: '8px 12px', maxHeight: 300, overflowY: 'auto' }}>
                    {candidates.map(bmp => (
                        <div
                            key={bmp.id}
                            className="simple-view-panel-item-row"
                            style={{
                                cursor: 'pointer',
                                padding: '8px',
                                marginBottom: 4,
                                borderRadius: 4,
                                backgroundColor: 'rgba(255,255,255,0.1)'
                            }}
                            onClick={() => onSelect(bmp)}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <strong>BMP {bmp.id}</strong>
                                    <span style={{ marginLeft: 8, opacity: 0.8 }}>
                                        {bmp.type_data?.name || 'Unknown type'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: 2 }}>
                                {bmp.group_profile?.title || 'No org'}
                                {bmp.updated_by ? ` · Last saved by ${bmp.updated_by}` : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const mapStateToProps = (state) => ({
    candidates: state?.swamm?.bmpChooserCandidates
});

const mapDispatchToProps = (dispatch) => ({
    onSelect: (bmp) => {
        dispatch(hideBmpChooser());
        dispatch(getBmpFormSuccess(bmp));
        dispatch(makeExistingBmpForm(bmp));
        dispatch(setUpdatingBmp(bmp));
        dispatch(showBmpForm());
    },
    onClose: () => dispatch(hideBmpChooser())
});

export default connect(mapStateToProps, mapDispatchToProps)(BmpChooserModal);
