// Scoped test entry (TASK-2068, GEO-CVE-003 FE half): the SanitizeUtils
// unit suite that proves DOMPurify neutralizes stored-XSS payloads before
// they reach dangerouslySetInnerHTML in the ResourceDetails DetailsPanel.
var sanitize = require.context('./js/utils/__tests__', false, /SanitizeUtils-test\.jsx?$/);
sanitize.keys().forEach(sanitize);
module.exports = sanitize;
