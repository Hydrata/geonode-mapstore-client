/*
 * Copyright 2026, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * One guarded message lookup, shared by every playback component that needs a
 * RAW translated string (title=, aria-label=, <option> text — positions where
 * <Message>'s <span> is invalid or impossible).
 *
 * THE GUARD IS THE POINT. `getMessageById(messages, id)` walks the dotted id
 * and returns whatever it lands on (MapStore2 utils/LocaleUtils.js:158-168):
 *
 *     let message = messages;
 *     msgId.split('.').forEach(part => { message = message ? message[part] : null; });
 *     return message || msgId;
 *
 * Land on a BRANCH rather than a leaf and it hands back the whole sub-tree
 * object, which is truthy and !== msgId, so a naive `resolved || fallback`
 * passes it straight into the attribute where it stringifies to
 * "[object Object]". That shipped once already (TASK-2744, fixed in gmc
 * 85030965f) and karma structurally cannot catch it, because every hydrata
 * component spec renders bare — no Provider, no Localized — so `context` is
 * {} and EVERY lookup misses and falls back to English.
 *
 * Hence: one implementation, type-guarded, imported everywhere.
 * See memory reference-getmessagebyid-subtree-returns-object.
 */
import { getMessageById } from '@mapstore/framework/utils/LocaleUtils';

export function translateOr(messages, msgId, fallback) {
    const resolved = getMessageById(messages || {}, msgId);
    if (typeof resolved !== 'string' || !resolved || resolved === msgId) {
        return fallback;
    }
    return resolved;
}

export default translateOr;
