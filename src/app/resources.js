const PROJECT_CUSTOM_FIELD_FIELDS = 'id,bundle(id),field(id,name,localizedName,fieldType(id,valueType))';
const ISSUE_FIELD_VALUE_FIELDS = 'id,name,localizedName,login,avatarUrl,name,presentation,minutes,color(id,foreground,background)';
const ISSUE_FIELD_FIELDS = `id,value(${ISSUE_FIELD_VALUE_FIELDS}),projectCustomField(${PROJECT_CUSTOM_FIELD_FIELDS})`;
const ISSUE_FIELDS = `id,idReadable,summary,resolved,fields(${ISSUE_FIELD_FIELDS})`;

const QUERY_ASSIST_FIELDS = 'query,caret,styleRanges(start,length,style),suggestions(options,prefix,option,suffix,description,matchingStart,matchingEnd,caret,completionStart,completionEnd,group,icon)';
const WATCH_FOLDERS_FIELDS = 'id,$type,name,query,shortName';

const DATE_PRESENTATION_SETTINGS = 'id,dateFieldFormat(pattern,datePattern)';

export async function loadIssues(fetchYouTrack, query, context, skip) {
  const packSize = 50;
  const encodedQuery = encodeURIComponent(query);
  if (context && context.id) {
    return await fetchYouTrack(
      `api/issueFolders/${context.id}/sortOrder/issues?fields=${ISSUE_FIELDS}&query=${encodedQuery}&$top=${packSize}&$skip=${skip || 0}`
    );
  }
  return await fetchYouTrack(
    `api/issues?fields=${ISSUE_FIELDS}&query=${encodedQuery}&$top=${packSize}&$skip=${skip || 0}`
  );
}

export async function loadTotalIssuesCount(
  fetchYouTrack, issue, query, context
) {
  const searchPage = await fetchYouTrack(
    'api/searchPage?fields=total', {
      method: 'POST',
      body: {
        pageSize: 0,
        folder: context && context.id && {
          id: context.id,
          $type: context.$type
        },
        query,
        issue: {id: issue.id}
      }
    }
  );
  return searchPage && searchPage.total;
}

export async function loadPinnedIssueFolders(fetchYouTrack, loadAll) {
  const packSize = 100;
  return await fetchYouTrack(`api/userIssueFolders?fields=${WATCH_FOLDERS_FIELDS}&$top=${loadAll ? -1 : packSize}`);
}

export async function loadDateFormats(fetchYouTrack) {
  const generalUserProfile = await fetchYouTrack(`api/admin/users/me/profiles/general?fields=${DATE_PRESENTATION_SETTINGS}`);
  const dateFormats =
    (generalUserProfile && generalUserProfile.dateFieldFormat) || {};
  return {
    datePattern: toFechaFormat(dateFormats.datePattern),
    dateTimePattern: toFechaFormat(dateFormats.pattern)
  };

  function toFechaFormat(pattern) {
    return (pattern || '').replace(/yy/g, 'YY').replace(/dd/g, 'DD').replace('aaa', 'A');
  }
}

export async function underlineAndSuggest(fetchYouTrack, query, caret, folder) {
  return await fetchYouTrack(`api/search/assist?fields=${QUERY_ASSIST_FIELDS}`, {
    method: 'POST',
    body: {query, caret, folder}
  });
}
