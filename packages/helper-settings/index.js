import browser from 'webextension-polyfill';

const store = {};

const defaults = {
  enablePrivateRepositories: true,
  showUpdateNotification: true,
  absolutePathsConfig: '',
};

export const get = key => {
  if (process.env.OCTOLINKER_LIVE_DEMO) {
    return;
  }

  return store[key];
};

export const set = async (key, value) => {
  if (process.env.OCTOLINKER_LIVE_DEMO) {
    return;
  }

  const data = {
    [key]: value,
  };

  return browser.storage.local.set(data);
};

export const save = async data => {
  if (process.env.OCTOLINKER_LIVE_DEMO) {
    return;
  }

  return browser.storage.local.set(data);
};

export const load = async () => {
  let data = {};

  if (!process.env.OCTOLINKER_LIVE_DEMO) {
    data = await browser.storage.local.get(null);
  }

  Object.assign(store, defaults, data);

  return store;
};

export const getAbsolutePathsConfig = () => {
  const config = get('absolutePathsConfig');
  return config
    .split(/\n/g)
    .map((line) => line.replace(/\s/g, ''))
    .filter((line) => line && !!line.match(/^[^:\/]+\/[^:\/]+:([^:]+:\/[^:]+)(;([^:]+:\/[^:]+))*$/))
    .map((line) => {
      const [_m, repository, configs] = line.match(/^([^:]+)+:(.*)$/);
      return {
        repository,
        configs: configs
          .split(';')
          .map((config) => config.split(':'))
          .map(([path, target]) => ({ path, target }))
      };
    })
  ;
}