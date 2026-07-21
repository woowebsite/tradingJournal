import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import NewsAI from './pages/NewsAI';
import NewsAnalysis from './pages/NewsAnalysis';
import NewsSummary from './pages/NewsSummary';
import Settings from './pages/Settings';
import Trades from './pages/Trades';
import Backtest from './pages/Backtest';
import Accounts from './pages/Accounts';
import ManageMarket from './pages/ManageMarket';
import ManageScored from './pages/ManageScored';
import ManageRules from './pages/ManageRules';
import ManageStrategies from './pages/ManageStrategies';
import Signals from './pages/Signals';
import ManageWatchlists from './pages/Watchlists';
import ManageSymbols from './pages/ManageSymbols';
import ManageWebhooks from './pages/ManageWebhooks';
import ManageWebhookSignals from './pages/ManageWebhookSignals';
import TradeStation from './pages/TradeStation';
import TodayTrades from './pages/TodayTrades';
import Portfolio from './pages/Portfolio';
import MarketFlow from './pages/MarketFlow';
import Derivation from './pages/Derivation';
import AccountDetail from './pages/AccountDetail';
import Journal from './pages/Journal';
import JournalWorkflow from './pages/JournalWorkflow';
import JournalCalendar from './pages/JournalCalendar';
import JournalTrade from './pages/JournalTrade';
import JournalAnalysis from './pages/JournalAnalysis';
import Plan from './pages/Plan';
import Roadmap from './pages/Roadmap';
import TCBSStrategySignals from './pages/TCBSStrategySignals';
import TCBSRecommendations from './pages/TCBSRecommendations';
import { AccountProvider } from './context/AccountContext';

function App() {
  return (
    <AccountProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="news-ai" element={<NewsAI />} />
            <Route path="news-analysis" element={<NewsAnalysis />} />
            <Route path="news-summary" element={<NewsSummary />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="accounts/:id" element={<AccountDetail />} />
            <Route path="trade-station" element={<TradeStation />} />
            <Route path="derivation" element={<Derivation />} />
            <Route path="today-trades" element={<TodayTrades />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="market-flow" element={<MarketFlow />} />
            <Route path="trades" element={<Trades />} />
            <Route path="backtest" element={<Backtest />} />
            <Route path="journal" element={<Journal />} />
            <Route path="journal-workflow" element={<JournalWorkflow />} />
            <Route path="journal-calendar" element={<JournalCalendar />} />
            <Route path="journal-plan" element={<Plan />} />
            <Route path="journal-roadmap" element={<Roadmap />} />
            <Route path="journal-trade" element={<JournalTrade />} />
            <Route path="journal-analysis" element={<JournalAnalysis />} />
            <Route path="settings" element={<Settings />} />
            <Route path="signals" element={<Signals />} />
            <Route path="tcbs-strategy-signals" element={<TCBSStrategySignals />} />
            <Route path="tcbs-recommendation" element={<TCBSRecommendations />} />
            <Route path="manage-market" element={<ManageMarket />} />
            <Route path="manage-scored" element={<ManageScored />} />
            <Route path="manage-rules" element={<ManageRules />} />
            <Route path="manage-strategies" element={<ManageStrategies />} />
            <Route path="manage-watchlists" element={<ManageWatchlists />} />
            <Route path="manage-symbols" element={<ManageSymbols />} />
            <Route path="webhooks" element={<Navigate to="/manage-webhooks" replace />} />
            <Route path="manage-webhooks" element={<ManageWebhooks />} />
            <Route path="webhook-signals" element={<ManageWebhookSignals />} />
            {/* Add more routes here */}
          </Route>
        </Routes>
      </Router>
    </AccountProvider>
  );
}

export default App;
