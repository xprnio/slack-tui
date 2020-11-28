import * as FS from 'fs';
import { CONFIG_PATH } from './constants';

export namespace Configuration {
  export type TeamTokenEntry = { name: string, token: string };
  export type TeamListConfiguration = TeamTokenEntry[];
}

export function loadTeamTokens(): Configuration.TeamListConfiguration {
  const contents = FS.readFileSync(CONFIG_PATH, 'utf-8');
  const config: [ string, string ][] = JSON.parse(contents);

  return config.map(([ token, name ]) => ({ name, token }));
}
