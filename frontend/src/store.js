import { configureStore } from '@reduxjs/toolkit';
import marketReducer from './features/marketSlice';
import ruleReducer from './features/ruleSlice';
import strategyReducer from './features/strategySlice';
import signalReducer from './features/signalSlice';
import watchlistReducer from './features/watchlistSlice';
import symbolReducer from './features/symbolSlice';
import tradeReducer from './features/tradeSlice';
import webhookReducer from './features/webhookSlice';

export const store = configureStore({
    reducer: {
        market: marketReducer,
        symbols: symbolReducer,
        strategies: strategyReducer,
        rules: ruleReducer,
        signals: signalReducer,
        watchlists: watchlistReducer,
        trades: tradeReducer,
        webhooks: webhookReducer,
    },
});
