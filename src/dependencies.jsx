import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import YAML from 'yamljs'

const filename = "docker-compose.yml";
const getServices = (folder, cxt) => {
  const content = fs.readFileSync(path.join(folder, filename), 'utf8');
  const parsed = YAML.parse(content);
  return _.keys(parsed.services);
}

export const getComposeDependencies = (folder, cxt) => {
  const services = getServices(folder, cxt);

  return _.map(services, srv => ({
    ...generateRegexDependency({
      kind: "dependency",
      folder,
      filename,
      regex: {
        fullname: ".+" + srv + ":\\s+image:(?:\\s+|)(.+):(?:.+)",
        version: ".+" + srv + ":\\s+image:(?:\\s+|)(?:.+):(.+)"
      }
    }, cxt),
    metadata: {
      service: srv
    }
  }));
}

export const list = async ({
  module: {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  }
}, cxt) => {
  const {pluginid} = cxt;
  return getComposeDependencies(folder, cxt);
}

export const sync = async ({
  module: {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  },
  dependency: {
    filename,
    path,
    version
  }
}, cxt) => {
  syncRegexDependency(folder, {filename, path, version});
  return {};
}

export const generateRegexDependency = ({
  kind,
  folder,
  filename,
  regex: {
    fullname: RegexToFullname,
    version: RegexToVersion
  }
}, cxt) => {
  const {pluginid} = cxt;
  const contentFile = path.join(folder, filename);

  if (fs.existsSync(contentFile)) {
    const content = fs.readFileSync(contentFile, 'utf8');

    const fullnameRegex = new RegExp(RegexToFullname, "gm");
    const versionRegex = new RegExp(RegexToVersion, "gm");

    const fullnameMatch = fullnameRegex.exec(content);
    const versionMatch = versionRegex.exec(content);

    if (fullnameMatch && versionMatch) {
      const fullnameValue = fullnameMatch[1];
      const versionValue = versionMatch[1];

      return {
        dependencyid: kind + "|" + filename + "|" + RegexToVersion,
        kind,
        filename,
        path: RegexToVersion,
        fullname: fullnameValue,
        version: versionValue
      };

    }
  }

  return null;
}

export const syncRegexDependency = (folder, {
  filename,
  path: pathToVersion,
  version
}) => {

  const contentFile = path.join(folder, filename);
  const content = fs.readFileSync(contentFile, 'utf8');

  const versionRegex = new RegExp(pathToVersion);
  const versionMatch = versionRegex.exec(content);

  if (versionMatch) {
    const syncFullmatch = versionMatch[0].replace(versionMatch[1], version);
    const syncContent = content.replace(versionRegex, syncFullmatch);
    console.log("SYNC REGEX DEPENDENCY");
    fs.writeFileSync(contentFile, syncContent);
  }

}
