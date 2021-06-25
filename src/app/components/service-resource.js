const SERVICE_FIELDS = 'id,name,applicationName,homeUrl,version';


async function getYouTrackServices(dashboardApi, optionalMinYouTrackVersion) {
  if (dashboardApi.loadServices) {
    return await dashboardApi.loadServices('YouTrack');
  }

  const data = await dashboardApi.fetchHub(`api/rest/services?fields=${SERVICE_FIELDS}&query=applicationName:YouTrack`);

  return (data && data.services || []).filter(
    service => !!service.homeUrl && (!optionalMinYouTrackVersion ||
      satisfyingVersion(service.version, optionalMinYouTrackVersion))
  );

  // eslint-disable-next-line complexity
  function satisfyingVersion(currentVersion, minVersion) {
    const currentVersionTokens = currentVersion.split('.').map(Number);
    const requestedVersionTokens = minVersion.
      split('.').map(Number);
    for (let i = 0; i < requestedVersionTokens.length; ++i) {
      if ((currentVersionTokens[i] > requestedVersionTokens[i]) ||
        (!isNaN(currentVersionTokens[i]) && isNaN(requestedVersionTokens[i]))
      ) {
        return true;
      }
      if (requestedVersionTokens[i] > currentVersionTokens[i] ||
        (isNaN(currentVersionTokens[i]) && !isNaN(requestedVersionTokens[i]))
      ) {
        return false;
      }
    }
    return true;
  }
}

async function getYouTrackService(dashboardApi, optionalYtId) {
  let services = await getYouTrackServices(dashboardApi);
  if (optionalYtId) {
    services = services.filter(service => service.id === optionalYtId);
  }
  return services[0];
}

export default {
  getYouTrackServices, getYouTrackService
};
