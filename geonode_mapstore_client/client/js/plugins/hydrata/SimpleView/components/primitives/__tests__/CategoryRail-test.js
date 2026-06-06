import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import {CategoryRail, tristateGlyph} from '../CategoryRail';

/**
 * TASK-1008 W4: render tests for the CategoryRail primitive.
 *
 * The primitive is presentation-only (no redux). `items` is a pre-computed
 * array of `{subHeading, groupLayers, allVisible, noneVisible}` and the
 * container owns `selectedSubHeading` local state plus the two callbacks
 * (`onSelect`, `onToggleGroupVisibility`).
 *
 * Note: `onSelect(subHeading)` is the contract — the container is responsible
 * for the redux dispatch (e.g. `setOpenMenuGroupId`); we do NOT assert that
 * here. The primitive only emits the subHeading string.
 */

const makeItem = (subHeading, overrides = {}) => ({
    subHeading,
    groupLayers: [],
    allVisible: false,
    noneVisible: true,
    ...overrides
});

describe('SimpleView CategoryRail primitive (TASK-1007 W3, tested in W4)', () => {
    let container;

    beforeEach((done) => {
        document.body.innerHTML = '<div id="container"></div>';
        container = document.getElementById('container');
        setTimeout(done);
    });

    afterEach((done) => {
        ReactDOM.unmountComponentAtNode(container);
        document.body.innerHTML = '';
        setTimeout(done);
    });

    describe('Container structure', () => {
        it('renders <div class="sv-category-rail" role="tablist"> as outer element', (done) => {
            ReactDOM.render(
                <CategoryRail items={[]} onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const rail = container.querySelector('.sv-category-rail');
                    expect(rail).toExist();
                    expect(rail.tagName).toBe('DIV');
                    expect(rail.getAttribute('role')).toBe('tablist');
                    done();
                }
            );
        });

        it('renders the empty rail (no children) when items=[]', (done) => {
            ReactDOM.render(
                <CategoryRail items={[]} onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const rail = container.querySelector('.sv-category-rail');
                    expect(rail).toExist();
                    expect(rail.querySelectorAll('.sv-category-rail-item').length).toBe(0);
                    done();
                }
            );
        });

        it('renders one .sv-category-rail-item per item (3 items -> 3 children)', (done) => {
            const items = [makeItem('A'), makeItem('B'), makeItem('C')];
            ReactDOM.render(
                <CategoryRail items={items} onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    expect(container.querySelectorAll('.sv-category-rail-item').length).toBe(3);
                    done();
                }
            );
        });
    });

    describe('Per-item structure', () => {
        it('each item is a div with role="tab" and tabIndex=0', (done) => {
            ReactDOM.render(
                <CategoryRail items={[makeItem('A')]} onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const item = container.querySelector('.sv-category-rail-item');
                    expect(item.tagName).toBe('DIV');
                    expect(item.getAttribute('role')).toBe('tab');
                    expect(item.getAttribute('tabindex')).toBe('0');
                    done();
                }
            );
        });

        it('sets aria-selected="true" on the active item and "false" on the others', (done) => {
            const items = [makeItem('A'), makeItem('B'), makeItem('C')];
            ReactDOM.render(
                <CategoryRail items={items} selectedSubHeading="B" onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const all = container.querySelectorAll('.sv-category-rail-item');
                    expect(all[0].getAttribute('aria-selected')).toBe('false');
                    expect(all[1].getAttribute('aria-selected')).toBe('true');
                    expect(all[2].getAttribute('aria-selected')).toBe('false');
                    done();
                }
            );
        });

        it('adds is-active class to the active item only', (done) => {
            const items = [makeItem('A'), makeItem('B')];
            ReactDOM.render(
                <CategoryRail items={items} selectedSubHeading="A" onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const all = container.querySelectorAll('.sv-category-rail-item');
                    expect(all[0].className).toInclude('is-active');
                    expect(all[1].className).toNotInclude('is-active');
                    done();
                }
            );
        });

        it('contains a tristate span and an <h5> label per item, and NO zoom span', (done) => {
            ReactDOM.render(
                <CategoryRail items={[makeItem('Terrain')]} onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const item = container.querySelector('.sv-category-rail-item');
                    expect(item.querySelector('.sv-category-rail-item-tristate')).toExist();
                    expect(item.querySelector('.sv-category-rail-item-zoom')).toNotExist();
                    const label = item.querySelector('h5.sv-category-rail-item-label');
                    expect(label).toExist();
                    expect(label.textContent).toBe('Terrain');
                    done();
                }
            );
        });
    });

    describe('Tristate glyph rendering (per item, conditional on allVisible/noneVisible)', () => {
        it('renders glyphicon-ok + glyph-active when allVisible=true, noneVisible=false', (done) => {
            const items = [makeItem('A', {allVisible: true, noneVisible: false})];
            ReactDOM.render(
                <CategoryRail items={items} onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const tri = container.querySelector('.sv-category-rail-item-tristate');
                    expect(tri.className).toInclude('glyphicon-ok');
                    expect(tri.className).toInclude('glyph-active');
                    done();
                }
            );
        });

        it('renders glyphicon-remove + glyph-inactive when allVisible=false, noneVisible=true', (done) => {
            const items = [makeItem('A', {allVisible: false, noneVisible: true})];
            ReactDOM.render(
                <CategoryRail items={items} onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const tri = container.querySelector('.sv-category-rail-item-tristate');
                    expect(tri.className).toInclude('glyphicon-remove');
                    expect(tri.className).toInclude('glyph-inactive');
                    done();
                }
            );
        });

        it('renders glyphicon-minus + glyph-partial when allVisible=false, noneVisible=false (partial)', (done) => {
            const items = [makeItem('A', {allVisible: false, noneVisible: false})];
            ReactDOM.render(
                <CategoryRail items={items} onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const tri = container.querySelector('.sv-category-rail-item-tristate');
                    expect(tri.className).toInclude('glyphicon-minus');
                    expect(tri.className).toInclude('glyph-partial');
                    done();
                }
            );
        });

        it('tristate span also carries the shared btn + glyphicon + menu-row-glyph + sv-category-rail-item-tristate classes', (done) => {
            ReactDOM.render(
                <CategoryRail items={[makeItem('A')]} onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const tri = container.querySelector('.sv-category-rail-item-tristate');
                    expect(tri.className).toInclude('btn');
                    expect(tri.className).toInclude('glyphicon');
                    expect(tri.className).toInclude('menu-row-glyph');
                    expect(tri.className).toInclude('sv-category-rail-item-tristate');
                    done();
                }
            );
        });
    });

    describe('tristateGlyph pure function', () => {
        it('returns "glyphicon-ok glyph-active" when allVisible=true, noneVisible=false', () => {
            expect(tristateGlyph(true, false)).toBe('glyphicon-ok glyph-active');
        });

        it('returns "glyphicon-remove glyph-inactive" when allVisible=false, noneVisible=true', () => {
            expect(tristateGlyph(false, true)).toBe('glyphicon-remove glyph-inactive');
        });

        it('returns "glyphicon-minus glyph-partial" when allVisible=false, noneVisible=false', () => {
            expect(tristateGlyph(false, false)).toBe('glyphicon-minus glyph-partial');
        });

        it('returns "glyphicon-ok glyph-active" for the degenerate (true, true) input (allVisible branch wins)', () => {
            expect(tristateGlyph(true, true)).toBe('glyphicon-ok glyph-active');
        });
    });

    describe('Zoom glyph removal', () => {
        it('does NOT render a zoom glyph (sv-category-rail-item-zoom / glyphicon-zoom-to) in any rail item', (done) => {
            const items = [makeItem('A'), makeItem('B')];
            ReactDOM.render(
                <CategoryRail items={items} onSelect={() => {}} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    expect(container.querySelectorAll('.sv-category-rail-item-zoom').length).toBe(0);
                    expect(container.querySelectorAll('.glyphicon-zoom-to').length).toBe(0);
                    done();
                }
            );
        });
    });

    describe('onSelect dispatch (click)', () => {
        it('clicking an item invokes onSelect with its subHeading string', (done) => {
            const calls = [];
            const onSelect = (sh) => calls.push(sh);
            ReactDOM.render(
                <CategoryRail items={[makeItem('Terrain')]} onSelect={onSelect} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    container.querySelector('.sv-category-rail-item').click();
                    expect(calls.length).toBe(1);
                    expect(calls[0]).toBe('Terrain');
                    done();
                }
            );
        });

        it('clicking a different item invokes onSelect with THAT item\'s subHeading', (done) => {
            const calls = [];
            const onSelect = (sh) => calls.push(sh);
            const items = [makeItem('A'), makeItem('B'), makeItem('C')];
            ReactDOM.render(
                <CategoryRail items={items} onSelect={onSelect} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const all = container.querySelectorAll('.sv-category-rail-item');
                    all[2].click();
                    expect(calls.length).toBe(1);
                    expect(calls[0]).toBe('C');
                    done();
                }
            );
        });

        it('clicking the tristate glyph does NOT invoke onSelect (stopPropagation)', (done) => {
            const calls = [];
            const onSelect = (sh) => calls.push(sh);
            ReactDOM.render(
                <CategoryRail items={[makeItem('A')]} onSelect={onSelect} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    container.querySelector('.sv-category-rail-item-tristate').click();
                    expect(calls.length).toBe(0);
                    done();
                }
            );
        });
    });

    describe('Keyboard selection', () => {
        it('pressing Enter on a focused item invokes onSelect(subHeading)', (done) => {
            const calls = [];
            const onSelect = (sh) => calls.push(sh);
            ReactDOM.render(
                <CategoryRail items={[makeItem('Terrain')]} onSelect={onSelect} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const item = container.querySelector('.sv-category-rail-item');
                    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
                    item.dispatchEvent(event);
                    expect(calls.length).toBe(1);
                    expect(calls[0]).toBe('Terrain');
                    done();
                }
            );
        });

        it('pressing Space on a focused item invokes onSelect(subHeading)', (done) => {
            const calls = [];
            const onSelect = (sh) => calls.push(sh);
            ReactDOM.render(
                <CategoryRail items={[makeItem('Boundary')]} onSelect={onSelect} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const item = container.querySelector('.sv-category-rail-item');
                    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
                    item.dispatchEvent(event);
                    expect(calls.length).toBe(1);
                    expect(calls[0]).toBe('Boundary');
                    done();
                }
            );
        });

        it('pressing ArrowDown on a focused item does NOT invoke onSelect', (done) => {
            const calls = [];
            const onSelect = (sh) => calls.push(sh);
            ReactDOM.render(
                <CategoryRail items={[makeItem('A')]} onSelect={onSelect} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const item = container.querySelector('.sv-category-rail-item');
                    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
                    item.dispatchEvent(event);
                    expect(calls.length).toBe(0);
                    done();
                }
            );
        });

        it('pressing Tab on a focused item does NOT invoke onSelect', (done) => {
            const calls = [];
            const onSelect = (sh) => calls.push(sh);
            ReactDOM.render(
                <CategoryRail items={[makeItem('A')]} onSelect={onSelect} onToggleGroupVisibility={() => {}} />,
                container,
                () => {
                    const item = container.querySelector('.sv-category-rail-item');
                    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
                    item.dispatchEvent(event);
                    expect(calls.length).toBe(0);
                    done();
                }
            );
        });
    });

    describe('onToggleGroupVisibility (tristate glyph click)', () => {
        it('invokes onToggleGroupVisibility(groupLayers, !allVisible, subHeading) when allVisible=false', (done) => {
            const calls = [];
            const onToggleGroupVisibility = (...args) => calls.push(args);
            const items = [makeItem('Terrain', {groupLayers: ['L1', 'L2'], allVisible: false, noneVisible: true})];
            ReactDOM.render(
                <CategoryRail items={items} onSelect={() => {}} onToggleGroupVisibility={onToggleGroupVisibility} />,
                container,
                () => {
                    container.querySelector('.sv-category-rail-item-tristate').click();
                    expect(calls.length).toBe(1);
                    expect(calls[0][0]).toEqual(['L1', 'L2']);
                    expect(calls[0][1]).toBe(true); // !allVisible
                    expect(calls[0][2]).toBe('Terrain');
                    done();
                }
            );
        });

        it('invokes onToggleGroupVisibility with 2nd arg=false when allVisible=true', (done) => {
            const calls = [];
            const onToggleGroupVisibility = (...args) => calls.push(args);
            const items = [makeItem('Boundary', {groupLayers: ['B1'], allVisible: true, noneVisible: false})];
            ReactDOM.render(
                <CategoryRail items={items} onSelect={() => {}} onToggleGroupVisibility={onToggleGroupVisibility} />,
                container,
                () => {
                    container.querySelector('.sv-category-rail-item-tristate').click();
                    expect(calls.length).toBe(1);
                    expect(calls[0][0]).toEqual(['B1']);
                    expect(calls[0][1]).toBe(false); // !allVisible
                    expect(calls[0][2]).toBe('Boundary');
                    done();
                }
            );
        });

        it('tristate glyph click does NOT bubble to onSelect (stopPropagation)', (done) => {
            const selectCalls = [];
            const toggleCalls = [];
            const onSelect = (sh) => selectCalls.push(sh);
            const onToggleGroupVisibility = (...args) => toggleCalls.push(args);
            ReactDOM.render(
                <CategoryRail items={[makeItem('A')]} onSelect={onSelect} onToggleGroupVisibility={onToggleGroupVisibility} />,
                container,
                () => {
                    container.querySelector('.sv-category-rail-item-tristate').click();
                    expect(toggleCalls.length).toBe(1);
                    expect(selectCalls.length).toBe(0);
                    done();
                }
            );
        });
    });

});
