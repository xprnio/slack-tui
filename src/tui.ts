import * as fs from 'fs';
import * as Blessed from 'blessed';

import { SlackUser } from './user';
import { SlackTeam } from './team';

export class SlackTUIView {
  teamBox;
  channelBox;
  userBox;
  inputBox;
  contentBox;
  screen;
  tui;

  constructor(tui: SlackTUI) {
    this.tui = tui;

    // Create a screen object.
    this.screen = Blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      dockBorders: true,
    });

    this.screen.title = 'slack-tui';

    this.teamBox = Blessed.list({
      top: 0,
      left: 0,
      width: '25%',
      height: '25%+1',
      tags: true,
      border: {
        type: 'line',
      },
      label: ' Teams ',
      style: {
        border: {
          fg: '#f0f0f0',
        },
        selected: {
          bg: 'red',
        },
        focus: {
          border: {
            fg: '#00ff00',
          },
        },
      },
      keys: true,
    });
    this.screen.append(this.teamBox);

    this.channelBox = Blessed.list({
      top: '25%',
      left: 0,
      width: '25%',
      height: '25%+1',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        //fg: 'white',
        //bg: 'magenta',
        border: {
          fg: '#f0f0f0',
        },
        selected: {
          bg: 'red',
        },
        focus: {
          border: {
            fg: '#00ff00',
          },
        },
      },
      label: ' Channels ',
      keys: true,
    });
    this.screen.append(this.channelBox);

    this.userBox = Blessed.list({
      top: '50%',
      left: 0,
      width: '25%',
      height: '50%',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        //fg: 'white',
        //bg: 'magenta',
        border: {
          fg: '#f0f0f0',
        },
        selected: {
          bg: 'red',
        },
        focus: {
          border: {
            fg: '#00ff00',
          },
        },
      },
      label: ' Users ',
      keys: true,
    });
    this.screen.append(this.userBox);

    this.contentBox = Blessed.log({
      top: 0,
      left: '25%',
      width: '75%',
      height: '80%+1',
      content: `
{green-bg}Welcome to SlackTUI!{/green-bg}
Use {red-fg}Tab{/red-fg} key to move box focus.
Use cursor keys to choose item.
			`,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: '#f0f0f0',
        },
        focus: {
          border: {
            fg: '#00ff00',
          },
        },
      },
      keys: true,
      scrollable: true,
    });
    this.screen.append(this.contentBox);

    this.inputBox = Blessed.textbox({
      top: '80%',
      left: '25%',
      width: '75%',
      height: '20%+1',
      content: 'Hello {bold}world{/bold}!',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        border: {
          fg: '#f0f0f0',
        },
        focus: {
          border: {
            fg: '#00ff00',
          },
        },
      },
      keys: true,
    });
    this.screen.append(this.inputBox);

    this.inputBox.on('submit', (text) => {
      this.inputBox.clearValue();
      this.inputBox.cancel();
      this.tui.sendMessage(text);
    });

    this.teamBox.on('select', (el, selected) => {
      const teamName = this.tui.getCanonicalTeamName(el.getText());
      this.tui.focusTeamByName(teamName);
    });

    this.channelBox.on('select', (el, selected) => {
      this.tui.focusedTeam.selectChannel(el.getText());
    });

    this.userBox.on('select', (el, selected) => {
      const index = this.userBox.getItemIndex(el);
      if ( !this.tui.focusedTeam ) return;
      const u: SlackUser = this.tui.focusedTeam.userList[ index ];
      if ( u ) {
        this.tui.focusedTeam.openIM(u.id, u.name);
      }
    });

    this.screen.key([ 'C-c' ], (ch, key) => {
      return process.exit(0);
    });

    this.screen.key([ 't' ], (ch, key) => {
      this.teamBox.focus();
    });

    this.teamBox.key([ 'tab' ], (ch, key) => {
      this.channelBox.focus();
    });
    this.channelBox.key([ 'tab' ], (ch, key) => {
      this.userBox.focus();
    });
    this.userBox.key([ 'tab' ], (ch, key) => {
      this.inputBox.focus();
    });
    this.inputBox.key([ 'tab' ], (ch, key) => {
      this.contentBox.focus();
    });
    this.contentBox.key([ 'tab' ], (ch, key) => {
      this.teamBox.focus();
    });


    this.teamBox.focus();

    this.screen.render();

  }
}

export class SlackTUI {
  configFile =
    process.env[ process.platform == 'win32' ? 'USERPROFILE' : 'HOME' ]
    + '/.teamlist.json';
  tokenList = [];
  teamDict: { [ key: string ]: SlackTeam } = {};
  view: SlackTUIView;
  private focusedTeam: SlackTeam = null;

  constructor() {
    this.view = new SlackTUIView(this);
    try {
      const config = fs.readFileSync(this.configFile, 'utf-8');
      this.tokenList = JSON.parse(config);
    } catch ( e ) {
      this.view.contentBox.log(
        'Error: failed to read ' + this.configFile);
      this.view.contentBox.log(
        'Please read https://github.com/xprnio/slack-tui/blob/master/README.md carefully.');
    }
    this.refreshTeamList();
  }

  getCanonicalTeamName(str: string) {
    return str.replace(/\(.*\)/g, '');
  }

  refreshTeamList() {
    const teamSelectorList = [];
    for ( const t of this.tokenList ) {
      teamSelectorList.push(t[ 1 ] + '(*)');
      this.teamDict[ t[ 1 ] ] = new SlackTeam(t, this);
    }
    this.view.teamBox.setItems(teamSelectorList);
    this.view.screen.render();
  }

  isTeamFocused(team: SlackTeam) {
    return (this.focusedTeam === team);
  }

  requestUpdateUserList(team: SlackTeam) {
    if ( !this.isTeamFocused(team) ) return;
    if ( !team.userSelectorList ) return;
    this.view.userBox.setItems(team.userSelectorList);
    this.view.screen.render();
  }

  requestLogToContentBox(team: SlackTeam, data: string) {
    if ( !this.isTeamFocused(team) ) return;
    this.view.contentBox.log(data);
    //this.screen.render();
  }

  requestClearContentBox(team: SlackTeam) {
    if ( !this.isTeamFocused(team) ) return;
    this.view.contentBox.setContent('');
  }

  requestSetLabelOfContentBox(team: SlackTeam, label: string) {
    if ( !this.isTeamFocused(team) ) return;
    this.view.contentBox.setLabel(' ' + label + ' ');
    this.view.contentBox.render();
  }

  focusTeamByName(teamName: string) {
    if ( !this.teamDict[ teamName ] ) return;
    this.focusedTeam = this.teamDict[ teamName ];
    this.focusedTeam.updateChannelListView();
    this.requestUpdateUserList(this.focusedTeam);
  }

  sendMessage(text: string) {
    if ( !this.focusedTeam ) return;
    this.focusedTeam.sendMessage(text);
  }
}
