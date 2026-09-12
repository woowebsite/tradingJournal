export default {
  routes: [
    {
      method: 'POST',
      path: '/news-analyses/refresh',
      handler: 'news-analysis.refresh',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-analyses/all-last-30',
      handler: 'news-analysis.listLast30',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/news-analyses/ai/analyze',
      handler: 'news-analysis.analyze',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/news-analyses/ai/global-macro',
      handler: 'news-analysis.globalMacro',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-analyses/dxy-price',
      handler: 'news-analysis.dxyPrice',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-analyses/brent-price',
      handler: 'news-analysis.brentPrice',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-analyses/wti-price',
      handler: 'news-analysis.wtiPrice',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-analyses/gold-price',
      handler: 'news-analysis.goldPrice',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-analyses/nasdaq-price',
      handler: 'news-analysis.nasdaqPrice',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-analyses/sp500-price',
      handler: 'news-analysis.sp500Price',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-analyses/fed-funds-rate',
      handler: 'news-analysis.fedFundsRate',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/news-analyses/us-cpi',
      handler: 'news-analysis.usCpi',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/news-analyses/ai/save',
      handler: 'news-analysis.saveAnalysis',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/news-analyses/ai/intraday-decision',
      handler: 'news-analysis.intradayDecision',
      config: {
        auth: false,
      },
    },
  ],
};
