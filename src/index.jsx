import {
  IO,
  Plugin
} from '@nebulario/core-plugin-request';

import * as Dependencies from './dependencies';
import * as Build from './build';
import * as Run from './run';
import {
  publish
} from './publish';

(async () => {

  await Plugin.run("compose", {
    dependencies: {
      list: Dependencies.list,
      sync: Dependencies.sync
    },
    run: {
      listen: Run.listen,
      start: Run.start
    },
    build: {
      start: Build.start
    },
    publish
  });

})().catch(e => {
  IO.sendEvent("plugin.fatal", {
    data: e.message
  });
  throw e;
});
