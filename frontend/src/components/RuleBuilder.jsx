import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';

// --- Constants & Config ---
const INDICATORS = {
    'macd': {
        params: ['fast', 'slow', 'signal'],
        defaults: { fast: 12, slow: 26, signal: 9 },
        outputs: ['macd', 'signal', 'histogram']
    },
    'rsi': {
        params: ['period'],
        defaults: { period: 14 },
        outputs: ['rsi']
    },
    'sma': {
        params: ['period'],
        defaults: { period: 20 },
        outputs: ['sma']
    },
    'ema': {
        params: ['period'],
        defaults: { period: 20 },
        outputs: ['ema']
    },
    'close': { params: [], defaults: {}, outputs: ['price'] },
    'open': { params: [], defaults: {}, outputs: ['price'] },
    'high': { params: [], defaults: {}, outputs: ['price'] },
    'low': { params: [], defaults: {}, outputs: ['price'] },
    'volume': { params: [], defaults: {}, outputs: ['volume'] }
};

const OPERATORS = ['<', '>', '<=', '>=', '==', '!='];

// --- Sub-components ---

const OperandInput = ({ value, onChange, label }) => {
    // value structure: { type: 'function'|'number', name, params, value }

    const handleChange = (field, val) => {
        const newData = { ...value, [field]: val };

        // Reset params if indicator changes
        if (field === 'name' && newData.type === 'function') {
            const config = INDICATORS[val];
            newData.params = { ...config.defaults };
            // Default field to close if not specified (for overlaid indicators)
            if (!['close', 'open', 'high', 'low', 'volume'].includes(val)) {
                newData.params.field = 'close';
            }
            // Default output
            if (config.outputs.length > 0) newData.params.output = config.outputs[0];
        }

        onChange(newData);
    };

    const handleParamChange = (paramKey, paramVal) => {
        onChange({
            ...value,
            params: {
                ...value.params,
                [paramKey]: Number(paramVal) // Ensure number
            }
        });
    };

    const handleStringParamChange = (paramKey, paramVal) => {
        onChange({
            ...value,
            params: {
                ...value.params,
                [paramKey]: paramVal
            }
        });
    };

    const toggleType = () => {
        const newType = value.type === 'function' ? 'number' : 'function';
        onChange({
            type: newType,
            // Defaults
            name: newType === 'function' ? 'macd' : undefined,
            params: newType === 'function' ? { fast: 12, slow: 26, signal: 9, field: 'close', output: 'macd' } : undefined,
            value: newType === 'number' ? 0 : undefined
        });
    };

    return (
        <div className="flex flex-col gap-2 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-400 font-bold uppercase">{label}</span>
                <button
                    type="button"
                    onClick={toggleType}
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                    Switch to {value.type === 'function' ? 'Number' : 'Indicator'}
                </button>
            </div>

            {value.type === 'number' ? (
                <input
                    type="number"
                    value={value.value || 0}
                    onChange={(e) => handleChange('value', Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                />
            ) : (
                <div className="space-y-2">
                    {/* Indicator Selector */}
                    <div className="flex gap-2">
                        <select
                            value={value.name || 'macd'}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                        >
                            {Object.keys(INDICATORS).map(ind => (
                                <option key={ind} value={ind}>{ind.toUpperCase()}</option>
                            ))}
                        </select>
                        {/* Offset */}
                        <div className="flex items-center gap-1 w-20" title="Offset (previous bars)">
                            <span className="text-xs text-gray-500">Ofs:</span>
                            <input
                                type="number"
                                value={value.params?.offset || 0}
                                onChange={(e) => handleParamChange('offset', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-1 py-1 text-sm text-white"
                            />
                        </div>
                    </div>

                    {/* Parameters */}
                    <div className="grid grid-cols-2 gap-2">
                        {value.name && INDICATORS[value.name]?.params.map(p => (
                            <div key={p} className="flex flex-col">
                                <label className="text-[10px] text-gray-500 uppercase">{p}</label>
                                <input
                                    type="number"
                                    value={value.params?.[p] || 0}
                                    onChange={(e) => handleParamChange(p, e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                />
                            </div>
                        ))}
                        {/* Output Selector (if multiple) */}
                        {value.name && INDICATORS[value.name]?.outputs.length > 1 && (
                            <div className="flex flex-col col-span-2">
                                <label className="text-[10px] text-gray-500 uppercase">Output</label>
                                <select
                                    value={value.params?.output || ''}
                                    onChange={(e) => handleStringParamChange('output', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                >
                                    {INDICATORS[value.name].outputs.map(out => (
                                        <option key={out} value={out}>{out}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {/* Input Field Selector (if applicable) */}
                        {value.name && !['close', 'open', 'high', 'low', 'volume'].includes(value.name) && (
                            <div className="flex flex-col col-span-2">
                                <label className="text-[10px] text-gray-500 uppercase">Input Field</label>
                                <select
                                    value={value.params?.field || 'close'}
                                    onChange={(e) => handleStringParamChange('field', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                                >
                                    {['close', 'open', 'high', 'low', 'volume'].map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const RuleRow = ({ rule, onChange, onDelete, index }) => {
    const handleOperandChange = (side, newData) => {
        onChange({ ...rule, [side]: newData });
    };

    const handleOperatorChange = (op) => {
        onChange({ ...rule, operator: op });
    };

    return (
        <div className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-gray-800 p-2 rounded-lg border border-gray-700 relative group">
            {/* Delete Button */}
            <button
                onClick={onDelete}
                className="absolute top-2 right-2 md:top-auto md:right-0 md:relative md:order-last p-1 text-gray-500 hover:text-red-400 opacity-100 md:opacity-0 group-hover:opacity-100 transition"
                title="Remove Rule"
            >
                <Trash2 size={16} />
            </button>

            <div className="flex-1 w-full">
                <OperandInput
                    label="Left"
                    value={rule.left}
                    onChange={(val) => handleOperandChange('left', val)}
                />
            </div>

            <div className="w-full md:w-auto flex justify-center py-2 md:py-0">
                <select
                    value={rule.operator}
                    onChange={(e) => handleOperatorChange(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white font-bold mx-2"
                >
                    {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
            </div>

            <div className="flex-1 w-full">
                <OperandInput
                    label="Right"
                    value={rule.right}
                    onChange={(val) => handleOperandChange('right', val)}
                />
            </div>
        </div>
    );
};

const RuleBuilder = ({ value, onChange }) => {
    // Correctly parse value to derived state to prevent re-render loop
    const { rules, condition } = useMemo(() => {
        try {
            const obj = typeof value === 'string' ? JSON.parse(value) : value;
            return {
                rules: Array.isArray(obj?.rules) ? obj.rules : [],
                condition: obj?.condition || 'AND'
            };
        } catch (e) {
            return { rules: [], condition: 'AND' };
        }
    }, [value]);

    const notifyChange = (newRules, newCondition) => {
        onChange({
            condition: newCondition,
            rules: newRules
        });
    };

    const addRule = () => {
        const newRules = [...rules, {
            left: { type: 'function', name: 'macd', params: { fast: 12, slow: 26, signal: 9, field: 'close', offset: 0, output: 'macd' } },
            operator: '<',
            right: { type: 'function', name: 'macd', params: { fast: 12, slow: 26, signal: 9, field: 'close', offset: 0, output: 'signal' } }
        }];
        notifyChange(newRules, condition);
    };

    const updateRule = (index, newRule) => {
        const newRules = [...rules];
        newRules[index] = newRule;
        notifyChange(newRules, condition);
    };

    const removeRule = (index) => {
        const newRules = rules.filter((_, i) => i !== index);
        notifyChange(newRules, condition);
    };

    return (
        <div className="space-y-4">
            {/* Global Condition */}
            <div className="flex items-center gap-3 mb-4">
                <span className="text-gray-400 text-sm">Valid if</span>
                <select
                    value={condition}
                    onChange={(e) => notifyChange(rules, e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white font-bold"
                >
                    <option value="AND">ALL conditions are met (AND)</option>
                    <option value="OR">ANY condition is met (OR)</option>
                </select>
            </div>

            {/* Rules List */}
            <div className="space-y-3">
                {rules.map((rule, index) => (
                    <RuleRow
                        key={index}
                        index={index}
                        rule={rule}
                        onChange={(newRule) => updateRule(index, newRule)}
                        onDelete={() => removeRule(index)}
                    />
                ))}

                {rules.length === 0 && (
                    <div className="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-lg">
                        No rules defined. Click "Add Rule" to start.
                    </div>
                )}
            </div>

            {/* Toolbar */}
            <button
                type="button"
                onClick={addRule}
                className="w-full py-2 border-2 border-dashed border-gray-600 text-gray-400 rounded-lg hover:border-blue-500 hover:text-blue-500 transition flex items-center justify-center gap-2"
            >
                <Plus size={18} />
                Add Rule
            </button>
        </div>
    );
};

export default RuleBuilder;
