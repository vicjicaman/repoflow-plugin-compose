import fs from 'fs'
import path from 'path'

export const replace = (content, env) => {
  let replaced = content;

  for (const groupKey in env) {
    const group = env[groupKey];
    for (const envVar in group) {
      const envVal = group[envVar];
      const key = groupKey === ""
        ? ""
        : envVar + "@" + groupKey;

      replaced = replaced.replace(new RegExp("\\$\\{" + key + "\\}", 'g'), envVal);
    }
  }

  return replaced;
}

export const get = (folder, extEnv) => {

  const content = fs.readFileSync(path.join(folder, ".env"), "utf8");
  const out = {};

  const lines = content.split('\n');
  for (const line of lines) {
    const i = line.indexOf('=');
    const key = line.substr(0, i);
    const val = line.substr(i + 1);

    if (val) {

      const gpi = key.indexOf('@');

      let valKey = key;
      let groupKey = ".";
      if (gpi !== -1) {
        valKey = key.substr(0, gpi);
        groupKey = key.substr(gpi + 1);
      }

      if (!out[groupKey]) {
        out[groupKey] = {
          ...extEnv
        };
      }

      const replaced = replace(val, out);
      if (replaced.charAt(0) === '"' && replaced.charAt(replaced.length - 1) === '"') {
        out[groupKey][valKey] = replaced.substr(1, replaced.length - 2);
      } else {
        out[groupKey][valKey] = replaced;
      }

    }
  }

  return out;
}
