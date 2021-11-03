import Rx from "rxjs";

import {
    INIT_ANUGA,
    REFRESH_ANUGA
} from "./actionsAnuga";
import axios from "../../../../MapStore2/web/client/libs/ajax";


export const refreshAnugaEpic = (action$) =>
    action$.ofType(REFRESH_ANUGA)
        .mergeMap(() => {
            return Rx.Observable.from(
                axios.get(`/anuga/api/update-from-airtables`)
            );
        })
        .mergeMap((response) => {
            console.log('refreshAnugaEpic Exhaust', response);
            if (response) {
                return Rx.Observable.of(
                    window.location.reload(false)
                );
            }
            return null;
        });


export const initAnugaEpic = (action$) =>
    action$.ofType(INIT_ANUGA)
        .mergeMap(() => {
            return Rx.Observable.from(
                axios.get(`/anuga/api/survey-site`)
            );
        })
        .mergeMap((response) => {
            if (response) {
                return Rx.Observable.of(
                    console.log(response.data)
                );
            }
            return null;
        });
