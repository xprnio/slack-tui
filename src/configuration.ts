import * as FS from 'fs';
import { CONFIG_PATH, CONFIG_PATH_LEGACY } from './constants';

export namespace Configuration {
  export type TeamTokenEntry = { name: string, token: string };
  export type TeamListConfiguration = TeamTokenEntry[];
}

export function useLegacyConfig(): boolean {
  return !FS.existsSync(CONFIG_PATH);
}

export function loadTeamTokens(): Configuration.TeamListConfiguration {
  if ( useLegacyConfig() ) {
    const contents = FS.readFileSync(CONFIG_PATH_LEGACY, 'utf-8');
    const config: [ string, string ][] = JSON.parse(contents);

    return config.map(([ token, name ]) => ({ name, token }));
  } else {
    const contents = FS.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(contents);
  }
}
