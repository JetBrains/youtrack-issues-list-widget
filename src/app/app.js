import 'babel-polyfill';
import 'hub-dashboard-addons/dashboard.css';

import React from 'react';
import {render} from 'react-dom';
import DashboardAddons from 'hub-dashboard-addons';
import {setLocale} from 'hub-dashboard-addons/dist/localization';

import IssuesListWidget from './issues-list-widget';
import TRANSLATIONS from './translations';
import ConfigWrapper from './config-wrapper';

const CONFIG_FIELDS = [
  'search', 'context', 'title', 'refreshPeriod', 'youTrack'
];

DashboardAddons.registerWidget(async (dashboardApi, registerWidgetApi) => {
  setLocale(DashboardAddons.locale, TRANSLATIONS);
  const configWrapper = new ConfigWrapper(dashboardApi, CONFIG_FIELDS);

  render(
    <IssuesListWidget
      dashboardApi={dashboardApi}
      configWrapper={configWrapper}
      registerWidgetApi={registerWidgetApi}
    />,
    document.getElementById('app')
  );
});
