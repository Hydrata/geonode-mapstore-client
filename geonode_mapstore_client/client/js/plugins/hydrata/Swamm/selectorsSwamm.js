export const bmpByUniqueNameSelector = (state) => state?.swamm?.bmpTypes ?
    state?.swamm?.bmpTypes.filter(
        (v, i, a)=>a.findIndex(t=>(t.name === v.name)
        ) === i
    ) :
    [];

// export const bmpDashboardDataSelector = (state) => {
//     let bmps = state?.swamm?.allBmps ? state?.swamm?.allBmps : [];
//     let outputObj = {};
//     bmps.filter((bmp) => bmp.status === 'Operational').map((bmp) => {
//         outputObj[bmp.id] = {
//             ...bmp
//         };
//     });
//     return [outputObj];
// };
//
// export const bmpSpeedDialSelector = (state) => {
//     const dashboardData = bmpDashboardDataSelector(state);
//     const totalBmpNitrogenReduction = Object.keys(dashboardData[0]).reduce((accumulator, currentValue) => {
//         return dashboardData[0][currentValue].total_n_load_reduction ?
//             accumulator + parseFloat(dashboardData[0][currentValue].total_n_load_reduction) :
//             accumulator;
//     }, 0
//     );
//     const totalBmpPhosphorusReduction = Object.keys(dashboardData[0]).reduce((accumulator, currentValue) => {
//         return dashboardData[0][currentValue].total_p_load_reduction ?
//             accumulator + parseFloat(dashboardData[0][currentValue].total_p_load_reduction) :
//             accumulator;
//     }, 0
//     );
//     const totalBmpSedimentReduction = Object.keys(dashboardData[0]).reduce((accumulator, currentValue) => {
//         return dashboardData[0][currentValue].total_s_load_reduction ?
//             accumulator + parseFloat(dashboardData[0][currentValue].total_s_load_reduction) :
//             accumulator;
//     }, 0
//     );
//     const mapId = state?.projectManager?.data?.base_map;
//     let totalResult =  {};
//     let target = state?.swamm?.targets?.filter((t) => t.id === state?.swamm?.selectedTargetId)[0];
//     totalResult[mapId] =  {
//         currentNitrogenLoad: target?.total_current_n_loading,
//         currentPhosphorusLoad: target?.total_current_p_loading,
//         currentSedimentLoad: target?.total_current_s_loading,
//         percentNitrogenReductionTarget: target?.target_percent_n_reduction,
//         percentPhosphorusReductionTarget: target?.target_percent_n_reduction,
//         percentSedimentReductionTarget: target?.target_percent_n_reduction,
//         totalBmpNitrogenReduction: totalBmpNitrogenReduction,
//         totalBmpPhosphorusReduction: totalBmpPhosphorusReduction,
//         totalBmpSedimentReduction: totalBmpSedimentReduction,
//         get targetNitrogenLoad() {
//             return this.currentNitrogenLoad * (this.percentNitrogenReductionTarget / 100);
//         },
//         get targetPhosphorusLoad() {
//             return this.currentPhosphorusLoad * (this.percentPhosphorusReductionTarget / 100);
//         },
//         get targetSedimentLoad() {
//             return this.currentSedimentLoad * (this.percentSedimentReductionTarget / 100);
//         },
//         get targetNitrogenLoadReduction() {
//             return this.currentNitrogenLoad - this.targetNitrogenLoad;
//         },
//         get targetPhosphorusLoadReduction() {
//             return this.currentPhosphorusLoad - this.targetPhosphorusLoad;
//         },
//         get targetSedimentLoadReduction() {
//             return this.currentSedimentLoad - this.targetSedimentLoad;
//         },
//         get percentNitrogenTarget() {
//             return [
//                 {
//                     name: "percentNitrogenTargetAcheived",
//                     value: (totalBmpNitrogenReduction / this.targetNitrogenLoadReduction ) * 100
//                 },
//                 {
//                     name: "percentNitrogenTargetRemaining",
//                     value: 100 - (totalBmpNitrogenReduction / this.targetNitrogenLoadReduction ) * 100
//                 }
//             ];
//         },
//         get percentPhosphorusTarget() {
//             return [
//                 {
//                     name: "percentPhosphorusTargetAcheived",
//                     value: (totalBmpPhosphorusReduction / this.targetPhosphorusLoadReduction ) * 100
//                 },
//                 {
//                     name: "percentNitrogenTargetRemaining",
//                     value: 100 - (totalBmpPhosphorusReduction / this.targetPhosphorusLoadReduction ) * 100
//                 }
//             ];
//         },
//         get percentSedimentTarget() {
//             return [
//                 {
//                     name: "percentSedimentTargetAcheived",
//                     value: (totalBmpSedimentReduction / this.targetSedimentLoadReduction ) * 100
//                 },
//                 {
//                     name: "percentSedimentTargetRemaining",
//                     value: 100 - (totalBmpSedimentReduction / this.targetSedimentLoadReduction ) * 100
//                 }
//             ];
//         }
//     };
//     return totalResult[state?.projectManager?.data?.base_map];
// };
