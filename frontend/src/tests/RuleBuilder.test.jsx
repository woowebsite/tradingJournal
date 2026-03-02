import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RuleBuilder from '../components/RuleBuilder';

describe('RuleBuilder', () => {
    it('renders correctly with empty rules', () => {
        const handleChange = vi.fn();
        render(<RuleBuilder value={{ rules: [], condition: 'AND' }} onChange={handleChange} />);

        expect(screen.getByText(/Valid if/i)).toBeInTheDocument();
        expect(screen.getByText(/No rules defined/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Rule/i })).toBeInTheDocument();
    });

    it('renders correctly with existing rules', () => {
        const initialValue = {
            condition: 'OR',
            rules: [
                {
                    left: { type: 'number', value: 10 },
                    operator: '>',
                    right: { type: 'number', value: 5 }
                }
            ]
        };
        const handleChange = vi.fn();
        render(<RuleBuilder value={initialValue} onChange={handleChange} />);

        // Check if condition selector is set to OR
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes[0]).toHaveValue('OR');

        // Check if rule is rendered (looking for inputs with values)
        expect(screen.getByDisplayValue('10')).toBeInTheDocument();
        expect(screen.getByDisplayValue('5')).toBeInTheDocument();
        expect(screen.getByDisplayValue('>')).toBeInTheDocument();
    });

    it('calls onChange when "Add Rule" is clicked', () => {
        const handleChange = vi.fn();
        render(<RuleBuilder value={{ rules: [], condition: 'AND' }} onChange={handleChange} />);

        fireEvent.click(screen.getByRole('button', { name: /Add Rule/i }));

        expect(handleChange).toHaveBeenCalledTimes(1);
        const arg = handleChange.mock.calls[0][0];
        expect(arg.rules).toHaveLength(1);
        // Default rule structure check
        expect(arg.rules[0].left.name).toBe('macd');
    });

    it('calls onChange when condition is changed', () => {
        const initialValue = { rules: [], condition: 'AND' };
        const handleChange = vi.fn();
        render(<RuleBuilder value={initialValue} onChange={handleChange} />);

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'OR' } });

        expect(handleChange).toHaveBeenCalledWith({
            rules: [],
            condition: 'OR'
        });
    });

    it('calls onChange when a rule is deleted', () => {
        const initialValue = {
            condition: 'AND',
            rules: [
                { left: { type: 'number', value: 1 }, operator: '==', right: { type: 'number', value: 1 } },
                { left: { type: 'number', value: 2 }, operator: '==', right: { type: 'number', value: 2 } }
            ]
        };
        const handleChange = vi.fn();
        render(<RuleBuilder value={initialValue} onChange={handleChange} />);

        const deleteButtons = screen.getAllByTitle('Remove Rule');
        fireEvent.click(deleteButtons[0]);

        expect(handleChange).toHaveBeenCalledTimes(1);
        const arg = handleChange.mock.calls[0][0];
        expect(arg.rules).toHaveLength(1);
        // Should have removed the first rule (value 1), so second rule (value 2) should remain
        expect(arg.rules[0].left.value).toBe(2);
    });

    it('updates rule when operand is changed', () => {
        const initialValue = {
            condition: 'AND',
            rules: [{
                left: { type: 'number', value: 10 },
                operator: '>',
                right: { type: 'number', value: 5 }
            }]
        };
        const handleChange = vi.fn();
        render(<RuleBuilder value={initialValue} onChange={handleChange} />);

        // Change the left number input from 10 to 20
        const leftInput = screen.getByDisplayValue('10');
        fireEvent.change(leftInput, { target: { value: '20' } });

        expect(handleChange).toHaveBeenCalled();
        const arg = handleChange.mock.calls[0][0];
        expect(arg.rules[0].left.value).toBe(20);
    });
});
