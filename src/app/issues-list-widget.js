import React from 'react';
import PropTypes from 'prop-types';
import LoaderInline from '@jetbrains/ring-ui/components/loader-inline/loader-inline';
import Link from '@jetbrains/ring-ui/components/link/link';
import {i18n} from 'hub-dashboard-addons/dist/localization';
import EmptyWidget, {EmptyWidgetFaces} from '@jetbrains/hub-widget-ui/dist/empty-widget';

import ServiceResource from './components/service-resource';
import {loadIssues, loadTotalIssuesCount} from './resources';
import IssuesListEditForm from './issues-list-edit-form';
import IssueLine from './issue-line';

import './style/issues-list-widget.scss';

class IssuesListWidget extends React.Component {
  static propTypes = {
    dashboardApi: PropTypes.object,
    registerWidgetApi: PropTypes.func
  };

  static DEFAULT_REFRESH_PERIOD = 240; // eslint-disable-line no-magic-numbers

  static digitToUnicodeSuperScriptDigit = digitSymbol => {
    const unicodeSuperscriptDigits = [
      0x2070, 0x00B9, 0x00B2, 0x00B3, 0x2074, // eslint-disable-line no-magic-numbers
      0x2075, 0x2076, 0x2077, 0x2078, 0x2079 // eslint-disable-line no-magic-numbers
    ];
    return String.fromCharCode(unicodeSuperscriptDigits[Number(digitSymbol)]);
  };

  static getIssueListLink = (homeUrl, context, search) => {
    let link = `${homeUrl}/`;
    if (context && context.shortName) {
      link += `issues/${context.shortName.toLowerCase()}`;
    } else if (context && context.$type) {
      if (context.$type.toLowerCase().indexOf('tag') > -1) {
        link += `tag/${context.name.toLowerCase()}-${context.id.split('-').pop()}`;
      } else {
        link += `search/${context.name.toLowerCase()}-${context.id.split('-').pop()}`;
      }
    } else {
      link += 'issues';
    }
    if (search) {
      link += `?q=${encodeURIComponent(search)}`;
    }
    return link;
  };

  static getFullSearchPresentation = (context, search) => [
    context && context.name && `#{${context.name}}`, search
  ].filter(str => !!str).join(' ') || `#${i18n('issues')}`;

  static getDefaultYouTrackService = async (dashboardApi, config) => {
    if (config && config.youTrack && config.youTrack.id) {
      return config.youTrack;
    }
    try {
      // TODO: pass min-required version here
      return await ServiceResource.getYouTrackService(
        dashboardApi.fetchHub.bind(dashboardApi)
      );
    } catch (err) {
      return null;
    }
  };

  constructor(props) {
    super(props);
    const {registerWidgetApi} = props;

    this.state = {
      isConfiguring: false,
      isLoading: true
    };

    registerWidgetApi({
      onConfigure: () => this.setState({
        isConfiguring: true,
        isLoading: false,
        isLoadDataError: false
      }),
      onRefresh: () => this.loadIssues()
    });
  }

  componentDidMount() {
    this.initialize(this.props.dashboardApi);
  }

  initialize = async dashboardApi => {
    this.setLoadingEnabled(true);
    const config = await dashboardApi.readConfig();
    const {search, context, title, refreshPeriod} = (config || {});
    const isNew = !config;

    if (!isNew) {
      this.changeSearch(search, context);
      await this.showListFromCache(search, context);
    }

    this.initRefreshPeriod(
      refreshPeriod || IssuesListWidget.DEFAULT_REFRESH_PERIOD
    );

    const youTrackService =
      await IssuesListWidget.getDefaultYouTrackService(dashboardApi, config);
    if (youTrackService && youTrackService.id) {
      const onYouTrackSpecified = async () => {
        if (isNew) {
          dashboardApi.enterConfigMode();
          this.setState({isConfiguring: true, isNew});
        } else {
          this.changeTitle(title);
          await this.loadIssues(search, context);
        }
        this.setLoadingEnabled(false);
      };
      this.setYouTrack(youTrackService, onYouTrackSpecified);
    } else {
      this.setState({isLoadDataError: true});
      this.setLoadingEnabled(false);
    }
  };

  setLoadingEnabled(isLoading) {
    this.props.dashboardApi.setLoadingAnimationEnabled(isLoading);
    this.setState({isLoading});
  }

  async showListFromCache(search, context) {
    const {dashboardApi} = this.props;
    const cache = (await dashboardApi.readCache() || {}).result;
    if (cache && cache.search === search &&
      (cache.context || {}).id === (context || {}).id) {
      this.setState({issues: cache.issues, fromCache: true});
    }
  }

  setYouTrack(youTrackService, onAfterYouTrackSetFunction) {
    this.setState({
      youTrack: {
        id: youTrackService.id,
        homeUrl: youTrackService.homeUrl
      }
    }, async () => await onAfterYouTrackSetFunction());
  }

  submitConfiguration = async formParameters => {
    const {
      search, title, context, refreshPeriod, selectedYouTrack
    } = formParameters;
    this.setYouTrack(
      selectedYouTrack, async () => {
        this.initRefreshPeriod(refreshPeriod);
        this.changeSearch(
          search, context, async () => {
            this.changeTitle(title);
            await this.loadIssues();
            await this.props.dashboardApi.storeConfig({
              search,
              context,
              title,
              refreshPeriod,
              youTrack: {
                id: selectedYouTrack.id,
                homeUrl: selectedYouTrack.homeUrl
              }
            });
            this.setState(
              {isConfiguring: false, fromCache: false, isNew: false}
            );
          }
        );
      }
    );
  };

  cancelConfiguration = async () => {
    if (this.state.isNew) {
      await this.props.dashboardApi.removeWidget();
    } else {
      this.setState({isConfiguring: false});
      await this.props.dashboardApi.exitConfigMode();
      this.initialize(this.props.dashboardApi);
    }
  };

  initRefreshPeriod = newRefreshPeriod => {
    if (newRefreshPeriod !== this.state.refreshPeriod) {
      this.setState({refreshPeriod: newRefreshPeriod});
    }

    const millisInSec = 1000;
    setTimeout(async () => {
      const {
        isConfiguring,
        refreshPeriod,
        search,
        context
      } = this.state;
      if (!isConfiguring && refreshPeriod === newRefreshPeriod) {
        await this.loadIssues(search, context);
        this.initRefreshPeriod(refreshPeriod);
      }
    }, newRefreshPeriod * millisInSec);
  };

  changeSearch = (search, context, onChangeSearchCallback) => {
    this.setState(
      {search: search || '', context},
      async () => onChangeSearchCallback && await onChangeSearchCallback()
    );
  };

  changeTitle = title => {
    this.setState(
      {title}, () => this.updateTitle()
    );
  };

  changeIssuesCount = issuesCount => {
    this.setState(
      {issuesCount}, () => this.updateTitle()
    );
  };

  fetchYouTrack = async (url, params) => {
    const {dashboardApi} = this.props;
    const {youTrack} = this.state;
    return await dashboardApi.fetch(youTrack.id, url, params);
  };

  updateTitle = () => {
    const {search, context, title, issuesCount, youTrack} = this.state;
    let displayedTitle =
      title || IssuesListWidget.getFullSearchPresentation(context, search);
    if (issuesCount) {
      const superScriptIssuesCount = `${issuesCount}`.split('').
        map(IssuesListWidget.digitToUnicodeSuperScriptDigit).join('');
      displayedTitle += ` ${superScriptIssuesCount}`;
    }
    this.props.dashboardApi.setTitle(
      displayedTitle,
      IssuesListWidget.getIssueListLink(youTrack.homeUrl, context, search)
    );
  };

  renderConfiguration() {
    return (
      <div className="issues-list-widget">
        <IssuesListEditForm
          search={this.state.search}
          context={this.state.context}
          title={this.state.title}
          refreshPeriod={this.state.refreshPeriod}
          onSubmit={this.submitConfiguration}
          onCancel={this.cancelConfiguration}
          dashboardApi={this.props.dashboardApi}
          youTrackId={this.state.youTrack.id}
        />
      </div>
    );
  }

  renderNoIssuesError() {
    const editSearchQuery = () => {
      this.props.dashboardApi.enterConfigMode();
      this.setState({isConfiguring: true});
    };

    return (
      <EmptyWidget
        face={EmptyWidgetFaces.OK}
        message={i18n('No issues found')}
      >
        <Link
          pseudo={true}
          onClick={editSearchQuery}
        >
          {i18n('Edit search query')}
        </Link>
      </EmptyWidget>
    );
  }

  renderLoadDataError() {
    return (
      <EmptyWidget
        face={EmptyWidgetFaces.ERROR}
        message={i18n('Can\'t load information from service.')}
      />
    );
  }

  async loadIssues(search, context) {
    try {
      await this.loadIssuesUnsafe(search, context);
    } catch (error) {
      this.setState({isLoadDataError: true});
    }
  }

  async loadIssuesUnsafe(search, context) {
    const currentSearch = search || this.state.search;
    const currentContext = context || this.state.context;
    const issues = await loadIssues(
      this.fetchYouTrack, currentSearch, currentContext
    );
    if (Array.isArray(issues)) {
      this.setState({issues, fromCache: false, isLoadDataError: false});
      this.props.dashboardApi.storeCache({
        search: currentSearch, context: currentContext, issues
      });
      this.loadIssuesCount(issues, currentSearch, currentContext);
    }
  }

  loadNextPageOfIssues = async () => {
    const {issues, search, context} = this.state;
    const loadMoreCount = this.getLoadMoreCount();
    if (loadMoreCount > 0) {
      this.setState({isNextPageLoading: true});
      const newIssues = await loadIssues(
        this.fetchYouTrack, search, context, issues.length
      );
      this.setState({
        isNextPageLoading: false,
        issues: issues.concat(newIssues || [])
      });
    }
  };

  async loadIssuesCount(issues, search, context) {
    const issuesCount = issues.length
      ? await loadTotalIssuesCount(
        this.fetchYouTrack, issues[0], search, context
      ) : 0;
    this.changeIssuesCount(issuesCount);
  }

  getLoadMoreCount() {
    const {issuesCount, issues} = this.state;
    return issues && issuesCount && issuesCount > issues.length
      ? issuesCount - issues.length : 0;
  }

  renderLoader() {
    return <LoaderInline/>;
  }

  renderWidgetBody() {
    const {
      issues,
      youTrack,
      expandedIssueId,
      isNextPageLoading
    } = this.state;
    const homeUrl = youTrack ? youTrack.homeUrl : '';
    const loadMoreCount = this.getLoadMoreCount();

    const setExpandedIssueId = issueId =>
      evt => {
        if (evt.target && evt.target.href) {
          return;
        }
        const isAlreadyExpended = issueId === expandedIssueId;
        this.setState({expandedIssueId: isAlreadyExpended ? null : issueId});
      };

    return (
      <div className="issues-list-widget">
        {
          (issues || []).map(issue => (
            <div
              key={`issue-${issue.id}`}
              onClick={setExpandedIssueId(issue.id)}
            >
              <IssueLine
                issue={issue}
                homeUrl={homeUrl}
                expanded={expandedIssueId === issue.id}
              />
            </div>
          ))
        }
        {
          loadMoreCount > 0 && !isNextPageLoading &&
          <div
            onClick={this.loadNextPageOfIssues}
            className="issues-list-widget__load-more"
          >
            <Link pseudo={true}>
              {
                loadMoreCount === 1
                  ? i18n('Load one more issue')
                  : i18n('Load {{loadMoreCount}} more issues', {loadMoreCount})
              }
            </Link>
          </div>
        }
        {
          isNextPageLoading && <LoaderInline/>
        }
      </div>
    );
  }

  // eslint-disable-next-line complexity
  render() {
    const {
      isConfiguring,
      issues,
      isLoading,
      fromCache,
      isLoadDataError
    } = this.state;

    if (isLoadDataError && !fromCache) {
      return this.renderLoadDataError();
    }
    if (isConfiguring) {
      return this.renderConfiguration();
    }
    if (isLoading && !fromCache) {
      return this.renderLoader();
    }
    if (!issues || !issues.length) {
      return this.renderNoIssuesError();
    }
    return this.renderWidgetBody();
  }
}


export default IssuesListWidget;
