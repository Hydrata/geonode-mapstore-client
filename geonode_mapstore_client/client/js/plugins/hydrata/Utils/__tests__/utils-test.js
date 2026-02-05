import expect from 'expect';
import { isInt, formatMoney, capitalizeFirstLetter } from '../utils';

describe('Utils', () => {
    describe('isInt', () => {
        it('should return true for positive integers', () => {
            expect(isInt(42)).toBe(true);
            expect(isInt(0)).toBe(true);
            expect(isInt(1)).toBe(true);
            expect(isInt(1000000)).toBe(true);
        });

        it('should return true for negative integers', () => {
            expect(isInt(-1)).toBe(true);
            expect(isInt(-42)).toBe(true);
        });

        it('should return false for floating point numbers', () => {
            expect(isInt(3.14)).toBe(false);
            expect(isInt(0.5)).toBe(false);
            expect(isInt(-2.5)).toBe(false);
        });

        it('should return true for integer strings', () => {
            expect(isInt('42')).toBe(true);
            expect(isInt('0')).toBe(true);
            expect(isInt('-10')).toBe(true);
        });

        it('should return false for float strings', () => {
            expect(isInt('3.14')).toBe(false);
            expect(isInt('0.5')).toBe(false);
        });

        it('should return false for non-numeric values', () => {
            expect(isInt('abc')).toBe(false);
            expect(isInt(NaN)).toBe(false);
            expect(isInt(undefined)).toBe(false);
            expect(isInt(null)).toBe(false);
        });
    });

    describe('formatMoney', () => {
        it('should format positive amounts with default settings', () => {
            expect(formatMoney(1234.56)).toBe('1,234.56');
            expect(formatMoney(1000)).toBe('1,000.00');
            expect(formatMoney(0)).toBe('0.00');
        });

        it('should format negative amounts', () => {
            expect(formatMoney(-1234.56)).toBe('-1,234.56');
            expect(formatMoney(-1000)).toBe('-1,000.00');
        });

        it('should respect custom decimal count', () => {
            expect(formatMoney(1234.5678, 3)).toBe('1,234.568');
            expect(formatMoney(1234, 0)).toBe('1,234');
            expect(formatMoney(1234.5678, 1)).toBe('1,234.6');
        });

        it('should respect custom decimal separator', () => {
            expect(formatMoney(1234.56, 2, ',')).toBe('1,234,56');
        });

        it('should respect custom thousands separator', () => {
            expect(formatMoney(1234.56, 2, '.', ' ')).toBe('1 234.56');
        });

        it('should handle large numbers', () => {
            expect(formatMoney(1234567890.12)).toBe('1,234,567,890.12');
        });

        it('should handle small decimals', () => {
            expect(formatMoney(0.01)).toBe('0.01');
            expect(formatMoney(0.99)).toBe('0.99');
        });
    });

    describe('capitalizeFirstLetter', () => {
        it('should capitalize the first letter of a lowercase string', () => {
            expect(capitalizeFirstLetter('hello')).toBe('Hello');
            expect(capitalizeFirstLetter('world')).toBe('World');
        });

        it('should not change already capitalized strings', () => {
            expect(capitalizeFirstLetter('Hello')).toBe('Hello');
            expect(capitalizeFirstLetter('HELLO')).toBe('HELLO');
        });

        it('should handle single character strings', () => {
            expect(capitalizeFirstLetter('a')).toBe('A');
            expect(capitalizeFirstLetter('A')).toBe('A');
        });

        it('should handle strings with spaces', () => {
            expect(capitalizeFirstLetter('hello world')).toBe('Hello world');
        });

        it('should handle strings starting with numbers', () => {
            expect(capitalizeFirstLetter('123abc')).toBe('123abc');
        });
    });
});
