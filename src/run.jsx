import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import YAML from 'yamljs';
import {
  exec,
  spawn
} from '@nebulario/core-process';
import {
  IO
} from '@nebulario/core-plugin-request';
import {
  syncRegexDependency
} from './dependencies'

export const listen = async (params, cxt) => {
  /*IO.sendEvent("out", {
    data: " - LISTEN "
  }, cxt);*/

  const {
    performerid: sourcePerformerID,
    taskid: sourceTaskID,
    event: sourceEvent
  } = params;

  IO.sendEvent("info", {
    data: "EVENT: " + sourceTaskID + "." + sourceEvent + "@" + sourcePerformerID
  }, cxt);

  if (params.operation) {
    /*IO.sendEvent("out", {
      data: " - LISTEN " + params.operation.operationid
    }, cxt);*/

    const {
      task: {
        taskid
      },
      performer: {
        performerid,
        type,
        output: {
          paths: {
            absolute: {
              folder: outputPath
            }
          }
        },
        dependents
      },
      instance: {
        instanceid
      },
      performers
    } = params.operation.params;

    const depSrvPerformer = _.find(performers, {
      performerid: sourcePerformerID
    });


    if (depSrvPerformer) {

      const serviceLabel = _.find(depSrvPerformer.labels, lbl => lbl.startsWith("service:"));

      if (serviceLabel) {
        const service = serviceLabel.split(":")[1];
        IO.sendEvent("out", {
          data: " - Service " + service
        }, cxt);

        IO.sendEvent("warning", {
          data: "RESTARTING... " + service
        }, cxt);

        try {

          /**/
          const inst = instanceid + "_" + performerid;
          const {
            stdout,
            stderr
          } = await exec(["cd " + outputPath, "docker-compose -p " + inst + "  restart " + service], {

          }, {}, cxt);


          IO.sendEvent("out", {
            data: stdout
          }, cxt);

          IO.sendEvent("warning", {
            data: stderr
          }, cxt);

          IO.sendEvent("out", {
            data: "RESTARTED"
          }, cxt);

        } catch (err) {
          IO.sendEvent("warning", {
            data: "RESTART_ERROR: " + err
          }, cxt);
        }


      } else {
        IO.sendEvent("warning", {
          data: "NO_SERVICE_LABEL: " + sourcePerformerID
        }, cxt);
      }
    } else {
      IO.sendEvent("warning", {
        data: "NO_TASK_PERFORMER: " + sourcePerformerID + "@" + taskid
      }, cxt);
    }



  }
}

export const start = (params, cxt) => {

  const {
    instance: {
      instanceid
    },
    performer: {
      performerid,
      type,
      output: {
        paths: {
          absolute: {
            folder: outputPath
          }
        }
      },
      code,
      code: {
        paths: {
          absolute: {
            folder: sourceFolder
          }
        }
      },
      dependents,
      module: {
        dependencies
      }
    },
    performers
  } = params;

  const filesToCopy = ["docker-compose.yml"];

  for (const compFile of filesToCopy) {
    const srcDockerCompose = path.join(sourceFolder, compFile);
    const destDockerCompose = path.join(outputPath, compFile);
    if (fs.existsSync(srcDockerCompose)) {
      fs.copySync(srcDockerCompose, destDockerCompose);
    }
  }

  const composePath = path.join(outputPath, "docker-compose.yml");
  const compose = YAML.load(composePath);

  for (const depSrv of dependents) {
    const depSrvPerformer = _.find(performers, {
      performerid: depSrv.moduleid
    });

    if (depSrvPerformer) {
      IO.sendEvent("out", {
        data: "Performing dependent found " + depSrv.moduleid
      }, cxt);

      if (depSrvPerformer.linked.includes("run")) {

        IO.sendEvent("info", {
          data: " - Linked " + depSrv.moduleid
        }, cxt);

        const serviceLabel = _.find(depSrvPerformer.labels, lbl => lbl.startsWith("service:"));

        if (serviceLabel) {
          const service = serviceLabel.split(":")[1];
          IO.sendEvent("out", {
            data: " - Service" + service
          }, cxt);

          const currServ = compose.services[service];
          const [imgName, imgVer] = currServ.image.split(":");
          currServ.image = imgName + ":linked";

          for (const perf of performers) {

            const {
              module: {
                fullname,
                type
              },
              code: {
                paths: {
                  absolute: {
                    folder: featModuleFolder
                  }
                }
              },
              linked
            } = perf;

            if (linked.includes("run") && type === "npm") {

              IO.sendEvent("info", {
                data: " - NPM linked " + perf.performerid
              }, cxt);

              const entry = featModuleFolder + ":/app/node_modules/" + fullname;
              if (!currServ.volumes) {
                currServ.volumes = [];
              }
              currServ.volumes.push(entry);
            }
          }


        } else {
          IO.sendEvent("warning", {
            data: " - No service label"
          }, cxt);
        }
      } else {
        IO.sendEvent("warning", {
          data: " - Not linked " + depSrv.moduleid
        }, cxt);
      }


    }

    /*



    if (appPerformer.linked.includes("run")) {
      IO.sendEvent("info", {
        data: " - App linked " + appPerformer.performerid
      }, cxt);

      const {
        module: {
          fullname
        },
        code: {
          paths: {
            absolute: {
              folder: featModuleFolder
            }
          }
        }
      } = appPerformer;

      const entry = featModuleFolder + ":/app/node_modules/" + fullname;
      if (!currServ.volumes) {
        currServ.volumes = [];
      }
      currServ.volumes.push(entry);


    } else {
      IO.sendEvent("warning", {
        data: " - App not linked " + appPerformer.performerid
      }, cxt);
    }

    */

    /*const {
      metadata: {
        service
      }
    } = depSrv;
    const appMod = _.find(modules, {
      moduleid: depSrv.moduleid
    });

    if (appMod) {
      dependentLink(compose.services['app'], modules, appMod);
    }*/
  }

  const ymlContent = YAML.stringify(compose, 4);
  fs.writeFileSync(composePath, ymlContent, 'utf8');

  //    '-e', '',
  return spawn('docker-compose', [
    '-p', instanceid + "_" + performerid,
    'up',
    '--remove-orphans',
    '--no-color'
  ], {
    cwd: outputPath
  }, {
    onOutput: async function({
      data
    }) {

      if (data.includes("Running")) {
        IO.sendEvent("done", {
          data
        }, cxt);
      }

      IO.sendEvent("out", {
        data
      }, cxt);
    },
    onError: async ({
      data
    }) => {
      IO.sendEvent("warning", {
        data
      }, cxt);
    }
  });

}
