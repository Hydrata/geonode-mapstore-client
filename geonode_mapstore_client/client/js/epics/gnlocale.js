/**
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Observable } from 'rxjs';
import {
    CHANGE_LOCALE
} from '@mapstore/framework/actions/locale';

import {
    setLanguage
} from '@js/api/geonode/v1';

import {
    getSupportedLocales
} from '@mapstore/framework/utils/LocaleUtils';

export const gnSetLanguageEpic = (action$) =>
    action$.ofType(CHANGE_LOCALE)
        .switchMap(({ locale }) => {
            const supportedLocales = getSupportedLocales();
            const localeKey = Object.keys(supportedLocales)
                .find(key => supportedLocales[key]?.code === locale);
            return Observable
                // update the language in django
                .defer(() => setLanguage(localeKey))
                .switchMap(() => {
                    return Observable.empty();
                });
        });

export default {
    gnSetLanguageEpic
};
