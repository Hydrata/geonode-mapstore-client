/*
 * TASK-743 — AnugaProjectList DOM contract tests (P1).
 *
 * AnugaProjectList is an UNCONNECTED presentational component (the default
 * export from ./AnugaProjectList/AnugaProjectList, wrapped in
 * `withResizeDetector`). It takes plain props; no redux. It is rendered here
 * through the shared `mountWithProviders` helper (AC2; the store is unused by
 * the component but keeps the 5 TASK-743 files consistent).
 *
 * The spec named no specific contracts for this component, so the following
 * REAL, deterministic observable contracts were derived from the source. NOTE:
 * the inner `Cards` child only renders its <ul> of ResourceCards once
 * `withResizeDetector` reports a width — which jsdom does not — so we
 * deliberately assert on contracts that DO NOT depend on a measured width:
 *
 *   (a) the results wrapper div is `display: block` when resources exist and
 *       `display: none` when the list is empty (the empty/populated toggle).
 *   (b) the loading Spinner (role="status") renders only while `loading`.
 *   (c) the prev/next pagination buttons' `disabled` state follows
 *       `isPreviousPageAvailable` / `isNextPageAvailable` (and `loading`).
 *   (d) clicking next/prev invokes `loadFeaturedResources` with the direction.
 *   (e) the `header` prop is rendered into the grid.
 */
import expect from 'expect';
import React from 'react';
import { fireEvent } from '@testing-library/react';
import mountWithProviders from '../../../../../__tests__/helpers/mountWithProviders';
import AnugaProjectList from '../AnugaProjectList/AnugaProjectList';

const noop = () => {};

// The resources column lives in a div whose display toggles block/none.
function resultsWrapper(container) {
    // .gn-card-grid > (header) > div[flex] > div[flex:1, display:block|none] > .gn-card-grid-container
    const gridContainer = container.querySelector('.gn-card-grid-container');
    return gridContainer ? gridContainer.parentNode : null;
}

describe('TASK-743 AnugaProjectList DOM', () => {

    it('shows the results column (display:block) when resources are present', () => {
        const { container } = mountWithProviders(
            <AnugaProjectList
                resources={[{ pk: 1, title: 'Proj A' }, { pk: 2, title: 'Proj B' }]}
                user={{ pk: 1, is_superuser: true }}
                onLoad={noop}
                loadFeaturedResources={noop}
            />
        );
        const wrapper = resultsWrapper(container);
        expect(wrapper).toExist();
        expect(wrapper.style.display).toBe('block');
    });

    it('hides the results column (display:none) when the resource list is empty', () => {
        const { container } = mountWithProviders(
            <AnugaProjectList
                resources={[]}
                onLoad={noop}
                loadFeaturedResources={noop}
            />
        );
        const wrapper = resultsWrapper(container);
        expect(wrapper).toExist();
        expect(wrapper.style.display).toBe('none');
    });

    it('renders the loading Spinner (.spinner) only while loading', () => {
        // NOTE: the Hydrata Spinner stub (js/components/Spinner) renders a bare
        // <div class="spinner"/> and ignores role/children, so we assert on
        // `.spinner` rather than role="status".
        const loadingResult = mountWithProviders(
            <AnugaProjectList
                resources={[{ pk: 1, title: 'P' }]}
                loading
                onLoad={noop}
                loadFeaturedResources={noop}
            />
        );
        expect(loadingResult.container.querySelector('.spinner')).toExist();

        const idleResult = mountWithProviders(
            <AnugaProjectList
                resources={[{ pk: 1, title: 'P' }]}
                loading={false}
                onLoad={noop}
                loadFeaturedResources={noop}
            />
        );
        expect(idleResult.container.querySelector('.spinner')).toNotExist();
    });

    it('disables both pagination buttons when no further pages are available', () => {
        const { container } = mountWithProviders(
            <AnugaProjectList
                resources={[{ pk: 1, title: 'P' }]}
                isNextPageAvailable={false}
                isPreviousPageAvailable={false}
                onLoad={noop}
                loadFeaturedResources={noop}
            />
        );
        const buttons = Array.from(container.querySelectorAll('.gn-card-grid-pagination button'));
        expect(buttons.length).toBe(2);
        expect(buttons.every(b => b.disabled)).toBe(true);
    });

    it('enables the next button when isNextPageAvailable and not loading', () => {
        const { container } = mountWithProviders(
            <AnugaProjectList
                resources={[{ pk: 1, title: 'P' }]}
                isNextPageAvailable
                isPreviousPageAvailable={false}
                loading={false}
                onLoad={noop}
                loadFeaturedResources={noop}
            />
        );
        const buttons = Array.from(container.querySelectorAll('.gn-card-grid-pagination button'));
        // Source order: previous button first, then next button.
        const [prevBtn, nextBtn] = buttons;
        expect(prevBtn.disabled).toBe(true);
        expect(nextBtn.disabled).toBe(false);
    });

    it('clicking next / previous invokes loadFeaturedResources with the matching direction', () => {
        const calls = [];
        const { container } = mountWithProviders(
            <AnugaProjectList
                resources={[{ pk: 1, title: 'P' }]}
                isNextPageAvailable
                isPreviousPageAvailable
                loading={false}
                onLoad={noop}
                loadFeaturedResources={(direction) => calls.push(direction)}
            />
        );
        const buttons = Array.from(container.querySelectorAll('.gn-card-grid-pagination button'));
        const [prevBtn, nextBtn] = buttons;
        fireEvent.click(nextBtn);
        fireEvent.click(prevBtn);
        expect(calls).toContain('next');
        expect(calls).toContain('previous');
    });

    it('renders the supplied header into the grid', () => {
        const { container } = mountWithProviders(
            <AnugaProjectList
                resources={[]}
                header={<div className="anuga-projects-header-probe">My Header</div>}
                onLoad={noop}
                loadFeaturedResources={noop}
            />
        );
        const header = container.querySelector('.anuga-projects-header-probe');
        expect(header).toExist();
        expect(header.textContent).toBe('My Header');
    });
});
