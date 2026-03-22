import expect from 'expect';
import React from 'react';
import ReactDOM from 'react-dom';
import { DashboardErrorFallback } from '../components/dashboard/DashboardContainer';

describe('SWAMM Dashboard', () => {

    // ── TASK-315: Error boundaries and loading states ──

    describe('DashboardErrorFallback', () => {
        it('test_dashboard_error_fallback_message', () => {
            const div = document.createElement('div');
            ReactDOM.render(<DashboardErrorFallback />, div);
            expect(div.textContent).toInclude('Dashboard encountered an error');
            expect(div.textContent).toInclude('Please try closing and reopening the dashboard');
            ReactDOM.unmountComponentAtNode(div);
        });
    });

});
