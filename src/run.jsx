import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import YAML from 'yamljs';
import {spawn} from '@nebulario/core-process';
import {IO} from '@nebulario/core-plugin-request';

const dependentLink = (service, modules, dependent) => {

  const {
    code: {
      paths: {
        absolute: {
          folder: appModuleFolder
        }
      },
      dependents
    },
    config
  } = dependent;

  for (const srvDependent of dependents) {
    const srvDependentMod = _.find(modules, {moduleid: srvDependent.moduleid});

    if (srvDependentMod) {
      const {
        fullname,
        type,
        code: {
          paths: {
            absolute: {
              folder: featModuleFolder
            }
          }
        },
        config
      } = srvDependentMod;

      if (type === "npm" && config.build.linked) {
        const entry = featModuleFolder + ":/app/node_modules/" + fullname;
        if (!service.volumes.includes(entry)) {
          service.volumes.push(entry);
        }
      }

      dependentLink(service, modules, srvDependentMod);
    }

  }

}

export const start = (params, cxt) => {

  const {
    module: {
      moduleid,
      mode,
      fullname,
      code: {
        paths: {
          absolute: {
            folder
          }
        },
        dependencies
      },
      instance: {
        instanceid
      }
    },
    modules
  } = params;

  const filesToCopy = [".env", "docker-compose.yml"];
  const outputPath = path.join(folder, "runtime");

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }

  for (const compFile of filesToCopy) {
    const srcDockerCompose = path.join(folder, compFile);
    const destDockerCompose = path.join(outputPath, compFile);
    if (fs.existsSync(srcDockerCompose)) {
      fs.copySync(srcDockerCompose, destDockerCompose);
    }
  }

  const composePath = path.join(outputPath, "docker-compose.yml");
  const compose = YAML.load(composePath);

  for (const depSrv of dependencies) {
    const {metadata: {
        service
      }} = depSrv;
    const appMod = _.find(modules, {moduleid: depSrv.moduleid});

    if (appMod) {
      dependentLink(compose.services[service], modules, appMod);
    }
  }

  const ymlContent = YAML.stringify(compose, 4);
  fs.writeFileSync(composePath, ymlContent, 'utf8');

  return spawn('docker-compose', [
    '-p', instanceid + "_" + moduleid,
    'up',
    '--remove-orphans',
    '--no-color'
  ], {
    cwd: outputPath
  }, {
    onOutput: async function({data}) {

      if (data.includes("Running at")) {
        IO.sendEvent("run.started", {
          data
        }, cxt);
      }

      IO.sendEvent("run.out", {
        data
      }, cxt);
    },
    onError: async ({data}) => {
      IO.sendEvent("run.err", {
        data
      }, cxt);
    }
  });

}
