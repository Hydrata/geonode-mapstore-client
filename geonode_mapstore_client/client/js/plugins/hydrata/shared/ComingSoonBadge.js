import React from 'react';
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';

// TASK-2126 — small inline "Coming soon" badge for launch-gated feature entry
// points (see launchGates.js). Renders the localized label and also exposes it
// as the hover title. Reads `messages` from the legacy i18n context;
// getMessageById returns the msgId unchanged when the key is missing, so it
// degrades gracefully before translations propagate to every locale.
//
// UAT-2 (epic 2359) — `variant="tooltip"`: same element and hook class, but
// styled as a hover/focus-revealed bubble under the (position:relative)
// parent control instead of an inline pill, for hosts the pill would
// oversize (the IDF Derive segment button). CSS :hover still applies to a
// :disabled button, so the reveal works on gated controls.
const ComingSoonBadge = ({ variant }, context) => {
    const messages = (context && context.messages) || {};
    const label = getMessageById(messages, 'hydrata.comingSoon');
    const tooltip = variant === 'tooltip';
    return (
        <span
            className={`sv-coming-soon-badge${tooltip ? ' sv-coming-soon-badge--tooltip' : ''}`}
            role={tooltip ? 'tooltip' : undefined}
            title={tooltip ? undefined : label}
        >
            <Message msgId="hydrata.comingSoon" />
        </span>
    );
};

ComingSoonBadge.propTypes = {
    /** 'inline' (default): pill in the flow. 'tooltip': hover/focus bubble. */
    variant: PropTypes.oneOf(['inline', 'tooltip'])
};

ComingSoonBadge.contextTypes = {
    messages: PropTypes.object
};

export default ComingSoonBadge;
