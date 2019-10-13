import _ from "lodash";
import fs from "fs-extra";
import path from "path";
import { exec, spawn } from "@nebulario/core-process";
import { IO } from "@nebulario/core-plugin-request";
import * as JsonUtils from "@nebulario/core-json";

export const listen = async (params, cxt) => {
  const {
    performerid: sourcePerformerID,
    taskid: sourceTaskID,
    event: sourceEvent
  } = params;

  IO.print(
    "info",
    "EVENT: " + sourceTaskID + "." + sourceEvent + "@" + sourcePerformerID,
    cxt
  );

  if (params.operation) {
    const {
      task: { taskid },
      performer: {
        performerid,
        type,
        output: {
          paths: {
            absolute: { folder: outputPath }
          }
        },
        dependents
      },
      instance: { instanceid },
      performers
    } = params.operation.params;

    const depSrvPerformer = _.find(performers, {
      performerid: sourcePerformerID
    });

    if (depSrvPerformer) {
      const serviceLabel = _.find(depSrvPerformer.labels, lbl =>
        lbl.startsWith("service:")
      );

      if (serviceLabel) {
        const service = serviceLabel.split(":")[1];
        IO.print("out", " - Service " + service, cxt);

        IO.print("warning", "RESTARTING... " + service, cxt);

        try {
          /**/
          const inst = instanceid + "_" + performerid;
          const { stdout, stderr } = await exec(
            [
              "cd " + outputPath,
              "docker-compose -p " + inst + "  restart " + service
            ],
            {},
            {},
            cxt
          );

          IO.print("out", stdout, cxt);

          IO.print("warning", stderr, cxt);

          IO.print("out", "RESTARTED", cxt);
        } catch (err) {
          IO.print("warning", "RESTART_ERROR: " + err, cxt);
        }
      }
    }
  }
};

export const transform = (params, cxt) => {
  const {
    instance: { instanceid },
    performer: {
      performerid,
      type,
      output: {
        paths: {
          absolute: { folder: outputPath }
        }
      },
      code,
      code: {
        paths: {
          absolute: { folder: sourceFolder }
        }
      },
      dependents,
      module: { dependencies }
    },
    performers,
    instance: {
      paths: {
        absolute: { folder: instanceFolder }
      }
    }
  } = params;

  const compose = JsonUtils.load(
    path.join(sourceFolder, "docker-compose.yml"),
    true
  );

  for (const srvKey in compose.services) {
    const currServ = compose.services[srvKey];
    const [imgName, imgVer] = currServ.image.split(":");

    const depSrvPerformer = _.find(
      performers,
      ({ module: { fullname } }) => fullname === imgName
    );

    if (depSrvPerformer.linked) {
      IO.print(
        "out",
        "Performing container found " + depSrvPerformer.performerid,
        cxt
      );
      currServ.image = imgName + ":linked";

      if (!currServ.volumes) {
        currServ.volumes = [];
      }

      currServ.volumes.push(path.join(instanceFolder, "modules") + ":/env");
      currServ.volumes.push(
        depSrvPerformer.code.paths.absolute.folder + ":/env/app"
      );
    }
  }

  JsonUtils.save(path.join(outputPath, "docker-compose.yml"), compose, true);
};

/*



for (const depSrv of dependents) {
  const depSrvPerformer = _.find(performers, {
    performerid: depSrv.moduleid
  });

  if (depSrvPerformer) {
    if (
      depSrvPerformer.linked &&
      depSrvPerformer.module.type === "container"
    ) {
      IO.print("info", " - Linked " + depSrvPerformer.performerid, cxt);

      if (serviceLabel) {
        const service = serviceLabel.split(":")[1];
        IO.print("out", " - Service" + service, cxt);

        const currServ = compose.services[service];
        const [imgName, imgVer] = currServ.image.split(":");
        currServ.image = imgName + ":linked";

        for (const perf of performers) {
          const {
            module: { fullname, type },
            code: {
              paths: {
                absolute: { folder: featModuleFolder }
              }
            },
            linked
          } = perf;

          if (linked && type === "npm") {
            IO.print("info", " - NPM linked " + perf.performerid, cxt);

            currServ.volumes.push(entry);
          }
        }
      }
    }
  }
}

if (serviceLabel) {
  const service = serviceLabel.split(":")[1];
  IO.print("out", " - Service" + service, cxt);

  const currServ = compose.services[service];
  const [imgName, imgVer] = currServ.image.split(":");
  currServ.image = imgName + ":linked";

  for (const perf of performers) {
    const {
      module: { fullname, type },
      code: {
        paths: {
          absolute: { folder: featModuleFolder }
        }
      },
      linked
    } = perf;

    if (linked && type === "npm") {
      IO.print("info", " - NPM linked " + perf.performerid, cxt);

      const entry =
        featModuleFolder + ":/env/app/node_modules/" + fullname;
      if (!currServ.volumes) {
        currServ.volumes = [];
      }
      currServ.volumes.push(entry);
    }
  }
}
*/

export const start = (params, cxt) => {
  const {
    instance: { instanceid },
    performer: {
      performerid,
      type,
      output: {
        paths: {
          absolute: { folder: outputPath }
        }
      },
      code,
      code: {
        paths: {
          absolute: { folder: sourceFolder }
        }
      },
      dependents,
      module: { dependencies }
    },
    performers
  } = params;

  const args = [
    "-p",
    instanceid + "_" + performerid,
    "up",
    "--remove-orphans",
    "--no-color"
  ];

  IO.print("info", outputPath + " => docker-compose " + args.join(" "), cxt);

  IO.print("done", "Starting compose for components", cxt);

  return spawn(
    "docker-compose",
    args,
    {
      cwd: outputPath
    },
    {
      onOutput: async ({ data }) => IO.print("out", data.toString(), cxt),
      onError: async ({ data }) => IO.print("warning", data.toString(), cxt)
    }
  );
};
