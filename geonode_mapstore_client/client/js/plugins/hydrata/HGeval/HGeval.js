import { createPlugin } from '../../../../MapStore2/web/client/utils/PluginsUtils';
import { connect } from 'react-redux';
import hgeval from "./reducersHGeval";
import HGevalContainer from "./components/hgevalContainer";
import { startReportEpic, saveReportEpic } from "./epicsHGeval";
import {
    setStep,
    setCoordinates,
    updateForm,
    startReport,
    saveReport,
    reset
} from "./actionsHGeval";
import {
    hgevalStepSelector,
    hgevalCoordinatesSelector,
    hgevalFormSelector,
    hgevalReportDataSelector,
    hgevalRasterValuesSelector,
    hgevalWarningsSelector,
    hgevalProgressSelector,
    hgevalLoadingSelector,
    hgevalErrorSelector,
    hgevalValidationErrorSelector,
    hgevalSavedReportSelector,
    isUserLoggedIn
} from "./selectorsHGeval";

import './styles/hgeval.css';

const ConnectedHGeval = connect(
    (state, ownProps) => ({
        step: hgevalStepSelector(state),
        coordinates: hgevalCoordinatesSelector(state),
        form: hgevalFormSelector(state),
        reportData: hgevalReportDataSelector(state),
        rasterValues: hgevalRasterValuesSelector(state),
        warnings: hgevalWarningsSelector(state),
        queryProgress: hgevalProgressSelector(state),
        loading: hgevalLoadingSelector(state),
        error: hgevalErrorSelector(state),
        validationError: hgevalValidationErrorSelector(state),
        savedReport: hgevalSavedReportSelector(state),
        isLoggedIn: isUserLoggedIn(state),
        rasterApiUrl: ownProps?.rasterApiUrl || '/nicp/api/raster/',
        reportApiUrl: ownProps?.reportApiUrl || '/nicp/api/reports/'
    }),
    {
        onSetStep: setStep,
        onSetCoordinates: setCoordinates,
        onUpdateForm: updateForm,
        onStartReport: startReport,
        onSaveReport: saveReport,
        onReset: reset
    }
)(HGevalContainer);

export default createPlugin('HGeval', {
    component: ConnectedHGeval,
    reducers: { hgeval },
    epics: {
        startReportEpic,
        saveReportEpic
    }
});
