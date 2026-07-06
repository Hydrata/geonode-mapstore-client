import React from 'react';
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
import {getMessageById} from '@mapstore/framework/utils/LocaleUtils';

// TASK-2126 — small inline "Coming soon" badge for launch-gated feature entry
// points (see launchGates.js). Renders the localized label and also exposes it
// as the hover title. Reads `messages` from the legacy i18n context;
// getMessageById returns the msgId unchanged when the key is missing, so it
// degrades gracefully before translations propagate to every locale.
const ComingSoonBadge = (props, context) => {
    const messages = (context && context.messages) || {};
    const label = getMessageById(messages, 'hydrata.comingSoon');
    return (
        <span className="sv-coming-soon-badge" title={label}>
            <Message msgId="hydrata.comingSoon" />
        </span>
    );
};

ComingSoonBadge.contextTypes = {
    messages: PropTypes.object
};

export default ComingSoonBadge;
