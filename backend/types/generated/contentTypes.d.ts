import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_sessions';
  info: {
    description: 'Session Manager storage';
    displayName: 'Session';
    name: 'Session';
    pluralName: 'sessions';
    singularName: 'session';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
    i18n: {
      localized: false;
    };
  };
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    childId: Schema.Attribute.String & Schema.Attribute.Private;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::session'> &
      Schema.Attribute.Private;
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique;
    status: Schema.Attribute.String & Schema.Attribute.Private;
    type: Schema.Attribute.String & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiAccountAccount extends Struct.CollectionTypeSchema {
  collectionName: 'accounts';
  info: {
    description: 'Trading accounts';
    displayName: 'Account';
    pluralName: 'accounts';
    singularName: 'account';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'USD'>;
    description: Schema.Attribute.String;
    initial_balance: Schema.Attribute.Float & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::account.account'
    > &
      Schema.Attribute.Private;
    market: Schema.Attribute.Relation<'manyToOne', 'api::market.market'>;
    moneyFormat: Schema.Attribute.String;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    roadmaps: Schema.Attribute.Relation<'oneToMany', 'api::roadmap.roadmap'>;
    setting: Schema.Attribute.Relation<'oneToOne', 'api::setting.setting'>;
    signals: Schema.Attribute.Relation<'oneToMany', 'api::signal.signal'>;
    strategy: Schema.Attribute.Relation<'oneToOne', 'api::strategy.strategy'>;
    trades: Schema.Attribute.Relation<'oneToMany', 'api::trade.trade'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    volumeFormat: Schema.Attribute.String;
    watch_lists: Schema.Attribute.Relation<
      'oneToMany',
      'api::watch-list.watch-list'
    >;
  };
}

export interface ApiIndustryIndustry extends Struct.CollectionTypeSchema {
  collectionName: 'industries';
  info: {
    displayName: 'Industry';
    pluralName: 'industries';
    singularName: 'industry';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::industry.industry'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiIntradayBsaIntradayBsa extends Struct.CollectionTypeSchema {
  collectionName: 'intraday_bsas';
  info: {
    displayName: 'IntradayBSA';
    pluralName: 'intraday-bsas';
    singularName: 'intraday-bsa';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    bms: Schema.Attribute.Integer;
    bsr: Schema.Attribute.Float;
    bu: Schema.Attribute.Integer;
    bup: Schema.Attribute.Float;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::intraday-bsa.intraday-bsa'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    s: Schema.Attribute.BigInteger;
    sd: Schema.Attribute.Integer;
    sdp: Schema.Attribute.Float;
    sms: Schema.Attribute.Integer;
    symbol_history: Schema.Attribute.Relation<
      'manyToOne',
      'api::symbol-history.symbol-history'
    >;
    t: Schema.Attribute.String;
    ticker: Schema.Attribute.String;
    timeWindow: Schema.Attribute.String;
    tWindow: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiInvestorInvestor extends Struct.CollectionTypeSchema {
  collectionName: 'investors';
  info: {
    displayName: 'Investor';
    pluralName: 'investors';
    singularName: 'investor';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    buyPercent: Schema.Attribute.Decimal;
    buyVolume: Schema.Attribute.Integer;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.Date;
    investorType: Schema.Attribute.Enumeration<['CM', 'SG', 'CN']>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::investor.investor'
    > &
      Schema.Attribute.Private;
    marketNetBuy: Schema.Attribute.Integer;
    netBuy: Schema.Attribute.Integer;
    netBuyAmount: Schema.Attribute.Integer;
    netShort: Schema.Attribute.Integer;
    netWeight: Schema.Attribute.Integer;
    publishedAt: Schema.Attribute.DateTime;
    sellPercent: Schema.Attribute.Decimal;
    sellVolume: Schema.Attribute.Integer;
    sourceDate: Schema.Attribute.String;
    symbol: Schema.Attribute.Relation<'manyToOne', 'api::symbol.symbol'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMarketAnalyticMarketAnalytic
  extends Struct.CollectionTypeSchema {
  collectionName: 'market_analytics';
  info: {
    displayName: 'Market Analytics';
    pluralName: 'market-analytics';
    singularName: 'market-analytic';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    bsi: Schema.Attribute.Float;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.DateTime & Schema.Attribute.Required;
    industry: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::market-analytic.market-analytic'
    > &
      Schema.Attribute.Private;
    psi: Schema.Attribute.Float;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMarketFlowMarketFlow extends Struct.CollectionTypeSchema {
  collectionName: 'market_flows';
  info: {
    displayName: 'Market Flow';
    pluralName: 'market-flows';
    singularName: 'market-flow';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.DateTime & Schema.Attribute.Required;
    industry: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::market-flow.market-flow'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    score: Schema.Attribute.Float;
    td: Schema.Attribute.BigInteger;
    ticker: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMarketMarket extends Struct.CollectionTypeSchema {
  collectionName: 'markets';
  info: {
    displayName: 'Market';
    pluralName: 'markets';
    singularName: 'market';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    accounts: Schema.Attribute.Relation<'oneToMany', 'api::account.account'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    Description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::market.market'
    > &
      Schema.Attribute.Private;
    Name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    scoreds: Schema.Attribute.Relation<'oneToMany', 'api::scored.scored'>;
    symbols: Schema.Attribute.Relation<'oneToMany', 'api::symbol.symbol'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNewsAnalysisNewsAnalysis
  extends Struct.CollectionTypeSchema {
  collectionName: 'news_analyses';
  info: {
    displayName: 'News Analysis';
    pluralName: 'news-analyses';
    singularName: 'news-analysis';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    articleUrl: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dayKey: Schema.Attribute.String & Schema.Attribute.Required;
    excerpt: Schema.Attribute.Text;
    fetchedAt: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::news-analysis.news-analysis'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sourceName: Schema.Attribute.String;
    sourceUrl: Schema.Attribute.String & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<['Unread', 'Read']> &
      Schema.Attribute.DefaultTo<'Unread'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNewsSummaryNewsSummary extends Struct.CollectionTypeSchema {
  collectionName: 'news_ai';
  info: {
    displayName: 'News Summary';
    pluralName: 'news-summaries';
    singularName: 'news-summary';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    day: Schema.Attribute.String & Schema.Attribute.Required;
    links: Schema.Attribute.JSON & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::news-summary.news-summary'
    > &
      Schema.Attribute.Private;
    model: Schema.Attribute.String;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    selectedCount: Schema.Attribute.Integer;
    selectedDays: Schema.Attribute.JSON;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNewsUrlNewsUrl extends Struct.CollectionTypeSchema {
  collectionName: 'news_urls';
  info: {
    displayName: 'NewsUrl';
    pluralName: 'news-urls';
    singularName: 'news-url';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::news-url.news-url'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['source', 'ignore']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ApiPlanPlan extends Struct.CollectionTypeSchema {
  collectionName: 'plans';
  info: {
    description: 'Daily and weekly trading plans per account';
    displayName: 'Plan';
    pluralName: 'plans';
    singularName: 'plan';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    accountId: Schema.Attribute.String & Schema.Attribute.Required;
    accountName: Schema.Attribute.String & Schema.Attribute.Required;
    checklist: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryPlan: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::plan.plan'> &
      Schema.Attribute.Private;
    marketContext: Schema.Attribute.Text;
    maxTrades: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<3>;
    planDate: Schema.Attribute.Date;
    publishedAt: Schema.Attribute.DateTime;
    reviewNotes: Schema.Attribute.Text;
    riskPlan: Schema.Attribute.Text;
    scope: Schema.Attribute.Enumeration<['Daily', 'Weekly']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'Daily'>;
    session: Schema.Attribute.String;
    status: Schema.Attribute.Enumeration<
      ['Draft', 'Active', 'Done', 'Skipped']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'Draft'>;
    symbols: Schema.Attribute.Text;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    weekEnd: Schema.Attribute.Date;
    weekStart: Schema.Attribute.Date;
  };
}

export interface ApiRoadmapRoadmap extends Struct.CollectionTypeSchema {
  collectionName: 'roadmaps';
  info: {
    description: 'Account growth roadmap targets and snapshots';
    displayName: 'Roadmap';
    pluralName: 'roadmaps';
    singularName: 'roadmap';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    account: Schema.Attribute.Relation<'manyToOne', 'api::account.account'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::roadmap.roadmap'
    > &
      Schema.Attribute.Private;
    maxDrawDownPercent: Schema.Attribute.Decimal;
    plannedTrades: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<25>;
    profitTarget: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    rewardMultiple: Schema.Attribute.Decimal;
    riskPercent: Schema.Attribute.Decimal;
    setting: Schema.Attribute.Relation<'manyToOne', 'api::setting.setting'>;
    snapshot: Schema.Attribute.JSON;
    startingBalance: Schema.Attribute.Decimal & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<
      ['unprocess', 'process', 'completed']
    > &
      Schema.Attribute.DefaultTo<'unprocess'>;
    targetBalance: Schema.Attribute.Decimal;
    targetGrowthPercent: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    winRateEstimate: Schema.Attribute.Decimal;
  };
}

export interface ApiRuleRule extends Struct.CollectionTypeSchema {
  collectionName: 'rules';
  info: {
    displayName: 'Rule';
    pluralName: 'rules';
    singularName: 'rule';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    Active: Schema.Attribute.Enumeration<['Enable', 'Disable']>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    Description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::rule.rule'> &
      Schema.Attribute.Private;
    Name: Schema.Attribute.String;
    percent: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    Rule: Schema.Attribute.JSON;
    signals: Schema.Attribute.Relation<'manyToMany', 'api::signal.signal'>;
    strategies: Schema.Attribute.Relation<
      'manyToMany',
      'api::strategy.strategy'
    >;
    Type: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiScoredScored extends Struct.CollectionTypeSchema {
  collectionName: 'scoreds';
  info: {
    description: 'Scored definitions grouped by market';
    displayName: 'Scored';
    pluralName: 'scoreds';
    singularName: 'scored';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    Description: Schema.Attribute.Text;
    Label: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::scored.scored'
    > &
      Schema.Attribute.Private;
    Market: Schema.Attribute.Relation<'manyToOne', 'api::market.market'>;
    publishedAt: Schema.Attribute.DateTime;
    trades: Schema.Attribute.Relation<'manyToMany', 'api::trade.trade'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSettingSetting extends Struct.CollectionTypeSchema {
  collectionName: 'settings';
  info: {
    displayName: 'Setting';
    pluralName: 'settings';
    singularName: 'setting';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    account: Schema.Attribute.Relation<'oneToOne', 'api::account.account'>;
    capitalRisk: Schema.Attribute.Decimal;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::setting.setting'
    > &
      Schema.Attribute.Private;
    maxDrawDown: Schema.Attribute.Decimal;
    Name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    riskPerTrade: Schema.Attribute.Decimal;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSignalSignal extends Struct.CollectionTypeSchema {
  collectionName: 'signals';
  info: {
    displayName: 'Signal';
    pluralName: 'signals';
    singularName: 'signal';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    account: Schema.Attribute.Relation<'manyToOne', 'api::account.account'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.DateTime;
    expired: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::signal.signal'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    rules: Schema.Attribute.Relation<'manyToMany', 'api::rule.rule'>;
    symbol: Schema.Attribute.Relation<'manyToOne', 'api::symbol.symbol'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiStockRatioStockRatio extends Struct.CollectionTypeSchema {
  collectionName: 'stock_ratios';
  info: {
    displayName: 'StockRatio';
    pluralName: 'stock-ratios';
    singularName: 'stock-ratio';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    ageOfInventory: Schema.Attribute.Decimal;
    ageOfReceivable: Schema.Attribute.Decimal;
    asset: Schema.Attribute.Decimal;
    badDebtPercentage: Schema.Attribute.Decimal;
    betaIndex: Schema.Attribute.Decimal;
    bookValuePerShare: Schema.Attribute.Decimal;
    capitalize: Schema.Attribute.Decimal;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    creditGrowth: Schema.Attribute.Decimal;
    customerCredit: Schema.Attribute.Decimal;
    dividend: Schema.Attribute.Decimal;
    earningPerShare: Schema.Attribute.Decimal;
    ebitOnInterest: Schema.Attribute.Decimal;
    equity: Schema.Attribute.Decimal;
    liability: Schema.Attribute.Decimal;
    loanOnDeposit: Schema.Attribute.Decimal;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::stock-ratio.stock-ratio'
    > &
      Schema.Attribute.Private;
    netProfit: Schema.Attribute.Decimal;
    nonInterestOnToi: Schema.Attribute.Decimal;
    operationProfit: Schema.Attribute.Decimal;
    payableOnEbitda: Schema.Attribute.Decimal;
    payableOnEquity: Schema.Attribute.Decimal;
    priceToBook: Schema.Attribute.Decimal;
    priceToEarning: Schema.Attribute.Decimal;
    profitGrowthAvarage: Schema.Attribute.Decimal;
    profitMargin: Schema.Attribute.Decimal;
    provisionOnBadDebt: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    revenue: Schema.Attribute.Decimal;
    roe: Schema.Attribute.Decimal;
    shortOnLongTermPayable: Schema.Attribute.Decimal;
    symbol: Schema.Attribute.Relation<'oneToOne', 'api::symbol.symbol'>;
    ticker: Schema.Attribute.String;
    tradeVolume: Schema.Attribute.Decimal;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    valueBeforeEbitda: Schema.Attribute.Decimal;
  };
}

export interface ApiStrategyStrategy extends Struct.CollectionTypeSchema {
  collectionName: 'strategies';
  info: {
    description: 'Trading strategies';
    displayName: 'Strategy';
    pluralName: 'strategies';
    singularName: 'strategy';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    account: Schema.Attribute.Relation<'oneToOne', 'api::account.account'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    entryRules: Schema.Attribute.Relation<'manyToMany', 'api::rule.rule'>;
    exitRules: Schema.Attribute.Relation<'manyToMany', 'api::rule.rule'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::strategy.strategy'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    rules: Schema.Attribute.Relation<'manyToMany', 'api::rule.rule'>;
    stoplossRules: Schema.Attribute.Relation<'manyToMany', 'api::rule.rule'>;
    takeProfitRules: Schema.Attribute.Relation<'manyToMany', 'api::rule.rule'>;
    template: Schema.Attribute.String;
    trades: Schema.Attribute.Relation<'oneToMany', 'api::trade.trade'>;
    type: Schema.Attribute.Enumeration<['Rules', 'Webhook']> &
      Schema.Attribute.DefaultTo<'Rules'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    webhook: Schema.Attribute.Relation<'manyToOne', 'api::webhook.webhook'>;
  };
}

export interface ApiSymbolHistorySymbolHistory
  extends Struct.CollectionTypeSchema {
  collectionName: 'symbol_histories';
  info: {
    displayName: 'SymbolHistory';
    pluralName: 'symbol-histories';
    singularName: 'symbol-history';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    close: Schema.Attribute.Float;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.DateTime;
    high: Schema.Attribute.Float;
    intraday_bsas: Schema.Attribute.Relation<
      'oneToMany',
      'api::intraday-bsa.intraday-bsa'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::symbol-history.symbol-history'
    > &
      Schema.Attribute.Private;
    low: Schema.Attribute.Float;
    open: Schema.Attribute.Float;
    publishedAt: Schema.Attribute.DateTime;
    symbol: Schema.Attribute.Relation<'manyToOne', 'api::symbol.symbol'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    volume: Schema.Attribute.Float;
  };
}

export interface ApiSymbolTechnicalAnalysisSymbolTechnicalAnalysis
  extends Struct.CollectionTypeSchema {
  collectionName: 'symbol_technical_analyses';
  info: {
    displayName: 'SymbolTechnicalAnalysis';
    pluralName: 'symbol-technical-analyses';
    singularName: 'symbol-technical-analysis';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    calculatedAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    k26: Schema.Attribute.Decimal;
    k78: Schema.Attribute.Decimal;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::symbol-technical-analysis.symbol-technical-analysis'
    > &
      Schema.Attribute.Private;
    ma200: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    supertrend: Schema.Attribute.Decimal;
    supertrendDirection: Schema.Attribute.Integer;
    symbol: Schema.Attribute.Relation<'oneToOne', 'api::symbol.symbol'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSymbolSymbol extends Struct.CollectionTypeSchema {
  collectionName: 'symbols';
  info: {
    displayName: 'Symbol';
    pluralName: 'symbols';
    singularName: 'symbol';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    chart_url: Schema.Attribute.String;
    companyType: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deltaInMonth: Schema.Attribute.Decimal;
    deltaInWeek: Schema.Attribute.Decimal;
    deltaInYear: Schema.Attribute.Decimal;
    Description: Schema.Attribute.String;
    establishedYear: Schema.Attribute.String;
    exchange: Schema.Attribute.String;
    foreignPercent: Schema.Attribute.Decimal;
    industry: Schema.Attribute.String;
    industryEn: Schema.Attribute.String;
    industryID: Schema.Attribute.Integer;
    industryIdLevel2: Schema.Attribute.String;
    industryIdLevel4: Schema.Attribute.String;
    industryIDv2: Schema.Attribute.String;
    investors: Schema.Attribute.Relation<'oneToMany', 'api::investor.investor'>;
    issueShare: Schema.Attribute.Decimal;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::symbol.symbol'
    > &
      Schema.Attribute.Private;
    market: Schema.Attribute.Relation<'manyToOne', 'api::market.market'>;
    Name: Schema.Attribute.String & Schema.Attribute.Unique;
    noEmployees: Schema.Attribute.Integer;
    noShareholders: Schema.Attribute.Integer;
    outstandingShare: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    sector: Schema.Attribute.String;
    shortName: Schema.Attribute.String;
    signals: Schema.Attribute.Relation<'oneToMany', 'api::signal.signal'>;
    stockRating: Schema.Attribute.Decimal;
    stockRatio: Schema.Attribute.Relation<
      'oneToOne',
      'api::stock-ratio.stock-ratio'
    >;
    symbol_histories: Schema.Attribute.Relation<
      'oneToMany',
      'api::symbol-history.symbol-history'
    >;
    technicalAnalysis: Schema.Attribute.Relation<
      'oneToOne',
      'api::symbol-technical-analysis.symbol-technical-analysis'
    >;
    ticker: Schema.Attribute.String;
    trades: Schema.Attribute.Relation<'oneToMany', 'api::trade.trade'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    watch_lists: Schema.Attribute.Relation<
      'manyToMany',
      'api::watch-list.watch-list'
    >;
    website: Schema.Attribute.String;
  };
}

export interface ApiTcbsRecommenTcbsRecommen
  extends Struct.CollectionTypeSchema {
  collectionName: 'tcbs_recommens';
  info: {
    displayName: 'TCBSRecommen';
    pluralName: 'tcbs-recommens';
    singularName: 'tcbs-recommen';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    d: Schema.Attribute.Date & Schema.Attribute.Required;
    listHisBuy: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tcbs-recommen.tcbs-recommen'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    reason: Schema.Attribute.Text;
    ticker: Schema.Attribute.String & Schema.Attribute.Required;
    type: Schema.Attribute.Integer;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value: Schema.Attribute.Decimal;
  };
}

export interface ApiTcbsStrategyDetailTcbsStrategyDetail
  extends Struct.CollectionTypeSchema {
  collectionName: 'tcbs_strategy_details';
  info: {
    displayName: 'TCBSStrategyDetail';
    pluralName: 'tcbs-strategy-details';
    singularName: 'tcbs-strategy-detail';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tcbs-strategy-detail.tcbs-strategy-detail'
    > &
      Schema.Attribute.Private;
    probByPeriod: Schema.Attribute.JSON;
    probPeriodDetail: Schema.Attribute.JSON;
    probStatistic: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    strategyKey: Schema.Attribute.String & Schema.Attribute.Required;
    strategyName: Schema.Attribute.String;
    ticker: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    volaByPeriod: Schema.Attribute.JSON;
    volaPeriodDetail: Schema.Attribute.JSON;
    volaStatistic: Schema.Attribute.JSON;
  };
}

export interface ApiTcbsStrategySignalTcbsStrategySignal
  extends Struct.CollectionTypeSchema {
  collectionName: 'tcbs_strategy_signals';
  info: {
    displayName: 'TCBSStrategySignal';
    pluralName: 'tcbs-strategy-signals';
    singularName: 'tcbs-strategy-signal';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    CPrice: Schema.Attribute.Decimal;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tcbs-strategy-signal.tcbs-strategy-signal'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    Sig: Schema.Attribute.Integer;
    strategy: Schema.Attribute.Relation<
      'manyToOne',
      'api::tcbs-strategy.tcbs-strategy'
    >;
    strategyKey: Schema.Attribute.String & Schema.Attribute.Required;
    TDate: Schema.Attribute.Date & Schema.Attribute.Required;
    ticker: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    Volume: Schema.Attribute.BigInteger;
  };
}

export interface ApiTcbsStrategyTcbsStrategy
  extends Struct.CollectionTypeSchema {
  collectionName: 'tcbs_strategies';
  info: {
    displayName: 'TCBSStrategy';
    pluralName: 'tcbs-strategies';
    singularName: 'tcbs-strategy';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tcbs-strategy.tcbs-strategy'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    signals: Schema.Attribute.Relation<
      'oneToMany',
      'api::tcbs-strategy-signal.tcbs-strategy-signal'
    >;
    strategyKey: Schema.Attribute.String & Schema.Attribute.Required;
    strategyName: Schema.Attribute.String;
    ticker: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTradeDetailTradeDetail extends Struct.CollectionTypeSchema {
  collectionName: 'trade_details';
  info: {
    displayName: 'TradeDetail';
    pluralName: 'trade-details';
    singularName: 'trade-detail';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::trade-detail.trade-detail'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Blocks;
    price: Schema.Attribute.Float;
    publishedAt: Schema.Attribute.DateTime;
    screenshot: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios'
    >;
    signal: Schema.Attribute.Enumeration<
      ['Entry', 'TakeProfit', 'Stoploss', 'Exit']
    >;
    trade: Schema.Attribute.Relation<'manyToOne', 'api::trade.trade'>;
    type: Schema.Attribute.Enumeration<['Buy', 'Sell']>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    volume: Schema.Attribute.Float;
  };
}

export interface ApiTradeTrade extends Struct.CollectionTypeSchema {
  collectionName: 'trades';
  info: {
    description: 'Individual trades';
    displayName: 'Trade';
    pluralName: 'trades';
    singularName: 'trade';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    account: Schema.Attribute.Relation<'manyToOne', 'api::account.account'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    date: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::trade.trade'> &
      Schema.Attribute.Private;
    mode: Schema.Attribute.Enumeration<['Real', 'Demo']> &
      Schema.Attribute.DefaultTo<'Real'>;
    note: Schema.Attribute.Blocks;
    pnl: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    scored: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    scoreds: Schema.Attribute.Relation<'manyToMany', 'api::scored.scored'>;
    strategy: Schema.Attribute.Relation<'manyToOne', 'api::strategy.strategy'>;
    symbol: Schema.Attribute.Relation<'manyToOne', 'api::symbol.symbol'>;
    trade_details: Schema.Attribute.Relation<
      'oneToMany',
      'api::trade-detail.trade-detail'
    >;
    trade_status: Schema.Attribute.Enumeration<
      ['Open', 'Closed', 'ScaleIn', 'ScaleOut']
    > &
      Schema.Attribute.DefaultTo<'Open'>;
    type: Schema.Attribute.Enumeration<['Long', 'Short']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiWatchListWatchList extends Struct.CollectionTypeSchema {
  collectionName: 'watch_lists';
  info: {
    displayName: 'WatchList';
    pluralName: 'watch-lists';
    singularName: 'watch-list';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    account: Schema.Attribute.Relation<'manyToOne', 'api::account.account'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    fromWatchlist: Schema.Attribute.Relation<
      'manyToOne',
      'api::watch-list.watch-list'
    >;
    isDefault: Schema.Attribute.Boolean;
    isSubWatchlist: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::watch-list.watch-list'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    rule: Schema.Attribute.JSON;
    symbols: Schema.Attribute.Relation<'manyToMany', 'api::symbol.symbol'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiWebhookSignalWebhookSignal
  extends Struct.CollectionTypeSchema {
  collectionName: 'webhook_signals';
  info: {
    displayName: 'WebHookSignal';
    pluralName: 'webhook-signals';
    singularName: 'webhook-signal';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    createdDate: Schema.Attribute.DateTime;
    desc: Schema.Attribute.String;
    image: Schema.Attribute.Media<'images'>;
    linked_symbol: Schema.Attribute.Relation<'manyToOne', 'api::symbol.symbol'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::webhook-signal.webhook-signal'
    > &
      Schema.Attribute.Private;
    price: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    signal: Schema.Attribute.String;
    signalStatus: Schema.Attribute.Enumeration<
      ['Execute', 'Unread', 'Reject']
    > &
      Schema.Attribute.DefaultTo<'Unread'>;
    symbol: Schema.Attribute.String;
    tf: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    webhook: Schema.Attribute.Relation<'manyToOne', 'api::webhook.webhook'>;
  };
}

export interface ApiWebhookWebhook extends Struct.CollectionTypeSchema {
  collectionName: 'webhooks';
  info: {
    displayName: 'Webhook';
    pluralName: 'webhooks';
    singularName: 'webhook';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    App: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    Description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::webhook.webhook'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    strategies: Schema.Attribute.Relation<
      'oneToMany',
      'api::strategy.strategy'
    >;
    Title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    webhook_signals: Schema.Attribute.Relation<
      'oneToMany',
      'api::webhook-signal.webhook-signal'
    >;
    webhookStatus: Schema.Attribute.Enumeration<['Enable', 'Disable']>;
    WebhookUrl: Schema.Attribute.String;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.String;
    caption: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.String;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::session': AdminSession;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::account.account': ApiAccountAccount;
      'api::industry.industry': ApiIndustryIndustry;
      'api::intraday-bsa.intraday-bsa': ApiIntradayBsaIntradayBsa;
      'api::investor.investor': ApiInvestorInvestor;
      'api::market-analytic.market-analytic': ApiMarketAnalyticMarketAnalytic;
      'api::market-flow.market-flow': ApiMarketFlowMarketFlow;
      'api::market.market': ApiMarketMarket;
      'api::news-analysis.news-analysis': ApiNewsAnalysisNewsAnalysis;
      'api::news-summary.news-summary': ApiNewsSummaryNewsSummary;
      'api::news-url.news-url': ApiNewsUrlNewsUrl;
      'api::plan.plan': ApiPlanPlan;
      'api::roadmap.roadmap': ApiRoadmapRoadmap;
      'api::rule.rule': ApiRuleRule;
      'api::scored.scored': ApiScoredScored;
      'api::setting.setting': ApiSettingSetting;
      'api::signal.signal': ApiSignalSignal;
      'api::stock-ratio.stock-ratio': ApiStockRatioStockRatio;
      'api::strategy.strategy': ApiStrategyStrategy;
      'api::symbol-history.symbol-history': ApiSymbolHistorySymbolHistory;
      'api::symbol-technical-analysis.symbol-technical-analysis': ApiSymbolTechnicalAnalysisSymbolTechnicalAnalysis;
      'api::symbol.symbol': ApiSymbolSymbol;
      'api::tcbs-recommen.tcbs-recommen': ApiTcbsRecommenTcbsRecommen;
      'api::tcbs-strategy-detail.tcbs-strategy-detail': ApiTcbsStrategyDetailTcbsStrategyDetail;
      'api::tcbs-strategy-signal.tcbs-strategy-signal': ApiTcbsStrategySignalTcbsStrategySignal;
      'api::tcbs-strategy.tcbs-strategy': ApiTcbsStrategyTcbsStrategy;
      'api::trade-detail.trade-detail': ApiTradeDetailTradeDetail;
      'api::trade.trade': ApiTradeTrade;
      'api::watch-list.watch-list': ApiWatchListWatchList;
      'api::webhook-signal.webhook-signal': ApiWebhookSignalWebhookSignal;
      'api::webhook.webhook': ApiWebhookWebhook;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
