import { SlackTUI } from './tui';

export type Logger = (str: String) => void;

export function createLogger(tui: SlackTUI): Logger {
  return function log(str: string) {
    tui.view.contentBox.log(str);
  };
}
