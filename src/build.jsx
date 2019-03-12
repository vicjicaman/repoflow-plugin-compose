import {spawn} from '@nebulario/core-process';
import {Operation, IO} from '@nebulario/core-plugin-request';
import {get as getEnv} from './env'
import _ from 'lodash'
import fs from 'fs-extra'
import path from 'path'
import YAML from 'yamljs';

export const start = (params, cxt) => {
  return {};
}
