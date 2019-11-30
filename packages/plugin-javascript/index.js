import { join, dirname, extname } from 'path';
import concatMap from 'concat-map';
import {
  REQUIRE,
  IMPORT,
  EXPORT,
} from '@octolinker/helper-grammar-regex-collection';
import liveResolverQuery from '@octolinker/resolver-live-query';
import resolverTrustedUrl from '@octolinker/resolver-trusted-url';
import builtinsDocs from './builtins-docs.js';
import * as storage from '@octolinker/helper-settings';

function getTopModuleName(target) {
  const isScoped = target.startsWith('@');
  const numComponents = isScoped ? 2 : 1;
  const topModuleName = target
    .split('/')
    .slice(0, numComponents)
    .join('/');
  return topModuleName;
}

export function javascriptFile({ path, target }) {
  const list = [];
  const extName = ['.js', '.jsx', '.ts', '.tsx', '.ls', '.json'];
  const basePath = join(dirname(path), target);
  const pathExt = extname(path);
  const fileExt = extname(basePath);

  if (extName.includes(fileExt)) {
    return javascriptFile({
      path,
      target: target.replace(fileExt, ''),
    });
  }

  if (pathExt && !extName.includes(pathExt)) {
    extName.unshift(pathExt);
  }

  extName.forEach(ext => {
    list.push(ext);
    list.push(`/index${ext}`);
  });

  list.push('');

  return concatMap(list, file => {
    const origPath = `{BASE_URL}${basePath}${file}`;
    const paths = [origPath];

    if (origPath.includes('/dist/')) {
      paths.push(origPath.replace('/dist/', '/lib/'));
      paths.push(origPath.replace('/dist/', '/src/'));
    } else if (origPath.includes('/lib/')) {
      paths.push(origPath.replace('/lib/', '/src/'));
    }

    return paths;
  });
}

function isURLImport(target) {
  try {
    const { origin } = new URL(target);
    return !!origin;
  } catch (error) {
    return false;
  }
}

export default {
  name: 'JavaScript',

  resolve(path, [target]) {
    if (isURLImport(target)) {
      return resolverTrustedUrl({ target });
    }

    const isBuiltIn = target in builtinsDocs;
    if (isBuiltIn) {
      return resolverTrustedUrl({ target: builtinsDocs[target] });
    }

    const isPath = !!target.match(/^\.\.?[\\|\/]?/);
    if (isPath) {
      return javascriptFile({ target, path });
    }
    
    const absoluteConfigs = storage.getAbsolutePathsConfig();
    
    const repo = path.replace(/^\/([^\/]+\/[^\/]+).*$/, '$1');
    const absoluteConfig = absoluteConfigs.find((config) => config.repository === repo);
    if (absoluteConfig) {
      const baseAbsPath = path.replace(/(^.*\/blob\/[^\/]*)\/.*$/, '$1');
      const computed = absoluteConfig.configs.reduce((res, config) => {
        // path: /OctoLinker/OctoLinker/blob/xxx/packages/yyy/currentFile.js
        // target: @octolinker/plugin-html
        // config.path: @octolinker
        // config.target: /packages
        if (target === config.path || target.startsWith(config.path + '/')) {
          const computedTarget = target.substring(config.path.length + 1); // => plugin-html
          const computedPath = `${baseAbsPath}${config.target}/`.replace(/\/*$/, ''); // => /OctoLinker/OctoLinker/blob/xxx/packages
          if (!res || computedPath.split('/').length > res.path.split('/').length) {
            return { target: computedTarget, path: computedPath };
          }
        }
        return res;
      }, undefined);
      if (computed) {
        return javascriptFile({ target: computed.target ? `./${computed.target}` : '.', path: `${computed.path}/index.js` });
      }
    }

    target = target.replace(/[^\w-.!~*'()@/]/g, '');

    // If the target looks like 'foo/bar.js', pretend it is 'foo' instead. See
    // https://github.com/OctoLinker/browser-extension/issues/93
    const topModuleName = getTopModuleName(target);

    return liveResolverQuery({ type: 'npm', target: topModuleName });
  },

  getPattern() {
    return {
      pathRegexes: [
        /\.jsx?$/,
        /\.es6$/,
        // CoffeeScript
        /\.coffee$/,
        /\.vue$/,
      ],
      githubClasses: [
        'type-javascript',
        'type-jsx',
        'highlight-source-js',
        // CoffeeScript
        'type-coffeescript',
        'highlight-source-coffee',
        'type-vue',
      ],
    };
  },

  getLinkRegexes() {
    return [REQUIRE, IMPORT, EXPORT];
  },
};
