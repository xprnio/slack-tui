import * as path from 'path';

export const HOME_DIR = process.platform === 'win32'
  ? process.env.USERPROFILE
  : process.env.HOME;

export const CONFIG_PATH = path.resolve(HOME_DIR, '.teamlist.json');
