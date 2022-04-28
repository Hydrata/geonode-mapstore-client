import {
    SET_VISIBLE_BIOCOLLECT_CHART,
    SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID,
    SAVE_SWAMPS_SURVEY_QUERY_TO_STORE,
    SET_SELECTED_X_KEY,
    SET_SELECTED_Y_KEY
} from "./actionsBiocollect";

const formatSwampData = (rawData) => {
    // console.log('rawData: ', rawData);
    const outputData = {};
    rawData.map((site) => {
        const siteId = site?.properties?.site_id;
        outputData[siteId] = {data: []};
        // let siteKeys = [];
        let availableYKeys = [];
        JSON.parse(site?.properties?.activities)?.map((activity) => {
            const dataList = activity?.outputs?.[0]?.data?.dataList;
            let keys = dataList.map(kv => kv.key);
            let timeKey;
            if (keys.indexOf('eventDate') > -1) {
                timeKey = 'eventDate';
            } else if (keys.indexOf('surveyDate') > -1) {
                timeKey = 'surveyDate';
            } else if (keys.indexOf('observationDate') > -1) {
                timeKey = 'observationDate';
            }
            const datestring = dataList.filter(kv => kv.key === timeKey)[0].value;
            const timestamp = Date.parse(datestring);
            // console.log('test:', outputData[siteId].data.filter((d) => d.time === timestamp));
            let dataPoint = outputData[siteId].data.filter((d) => d.time === timestamp)[0] || {};
            // if (outputData[siteId].data.filter((d) => d.time === timestamp)) {
            //     dataPoint = outputData[siteId].data.filter((d) => d.time === timestamp)[0];
            // }
            // console.log('dataPoint:', dataPoint);
            dataPoint.time = timestamp;
            keys.map((key) => {
                const dataValue = dataList.filter(kv => kv.key === key)[0].value;
                if (parseFloat(dataValue)) {
                    dataPoint[key] = parseFloat(dataValue);
                    if (availableYKeys.indexOf(key) === -1) {
                        availableYKeys.push(key);
                    }
                }
            });
            outputData[siteId].data.push(dataPoint);
        });
        outputData[siteId].availableXKeys = ['time'];
        outputData[siteId].availableYKeys = availableYKeys;
    });
    // console.log('outputData Final:', outputData);
    return outputData;
};

export default ( state = {}, action) => {
    console.log(action);
    switch (action.type) {
    case SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID:
        return {
            ...state,
            currentBiocollectSurveySiteId: action.currentBiocollectSurveySiteId
        };
    case SAVE_SWAMPS_SURVEY_QUERY_TO_STORE:
        return {
            ...state,
            swampsSurveyData: action.swampsSurveyData,
            processedSwampsSurveyData: formatSwampData(action.swampsSurveyData)
        };
    case SET_VISIBLE_BIOCOLLECT_CHART:
        return {
            ...state,
            visibleBiocollectChart: action.visible
        };
    case SET_SELECTED_X_KEY:
        return {
            ...state,
            selectedXKey: action.selectedXKey
        };
    case SET_SELECTED_Y_KEY:
        return {
            ...state,
            selectedYKey: action.selectedYKey
        };
    default:
        return state;
    }
};
