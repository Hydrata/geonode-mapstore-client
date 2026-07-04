/**
 * Shared axios error-shape readers (extracted from crudEpics.js during the
 * epic-2092 W4 simplify pass — membershipEpics.js had grown an identical
 * copy for its own 402 interception).
 *
 * Error shape gotcha: MapStore2's libs/ajax.js response interceptor
 * rewrites axios rejections to the response BLOB (status, data, headers,
 * originalError) directly — so the canonical read is `err.status` /
 * `err.data`, NOT a stock axios Error's `err.response.status` /
 * `err.response.data`. axios-mock-adapter (used by the test suite)
 * preserves the `err.response.*` shape, so both forms are read defensively.
 */

export const readErrStatus = (err) => err?.status ?? err?.response?.status;
export const readErrData = (err) => err?.data ?? err?.response?.data ?? {};
