import * as Blessed from 'blessed';
import { Widgets } from 'blessed';
import { Configuration, loadTeamTokens } from './configuration';
import { CONFIG_PATH } from './constants';
import { SlackTeam } from './team';
import { SlackUser } from './user';
import { toCanonicalName } from './util';
import TeamListConfiguration = Configuration.TeamListConfiguration;

export class SlackTUI {
  tokenList: TeamListConfiguration = [];
  teamDict: Map<String, SlackTeam> = new Map();
  focusedTeam: SlackTeam;
  view: SlackTUIView;

  constructor() {
    this.view = new SlackTUIView(this);

    this.loadConfig();
    this.refreshTeamList();
  }

  refreshTeamList() {
    const teamSelectorList = this.tokenList.map(({ name, token }) => {
      this.teamDict.set(name, new SlackTeam(this, { name, token }));
      return Blessed.text({ content: `${ name }(*)` });
    });
    this.view.teamBox.setItems(teamSelectorList);
    this.view.screen.render();
  }

  isTeamFocused(team: SlackTeam) {
    return this.focusedTeam === team;
  }

  requestUpdateUserList(team: SlackTeam) {
    if ( team.isFocused() ) {
      const elements = team.userSelectorList.map(
        selector => Blessed.text({ content: selector }),
      );
      this.view.userBox.setItems(elements);
      this.view.screen.render();
    }
  }

  requestLogToContentBox(team: SlackTeam, data: string) {
    if ( team.isFocused() ) {
      this.view.contentBox.log(data);
    }
  }

  requestClearContentBox(team: SlackTeam) {
    if ( team.isFocused() ) {
      this.view.contentBox.setContent('');
    }
  }

  requestSetLabelOfContentBox(team: SlackTeam, label: string) {
    if ( team.isFocused() ) {
      this.view.contentBox.setLabel(' ' + label + ' ');
      this.view.contentBox.render();
    }
  }

  focusTeamByName(teamName: string) {
    if ( this.teamDict.has(teamName) ) {
      this.focusedTeam = this.teamDict.get(teamName);
      this.focusedTeam.updateChannelListView();
      this.requestUpdateUserList(this.focusedTeam);
    }
  }

  sendMessage(text: string) {
    if ( !this.focusedTeam ) return;
    this.focusedTeam.sendMessage(text);
  }

  private loadConfig() {
    try {
      this.tokenList = loadTeamTokens();
    } catch ( e ) {
      this.view.contentBox.log('Error: failed to read ' + CONFIG_PATH);
      this.view.contentBox.log('Please read https://github.com/xprnio/slack-tui/blob/master/README.md carefully.');
    }
  }
}

export class SlackTUIView {
  public readonly screen: Widgets.Screen;

  public readonly teamBox: Widgets.ListElement;
  public readonly channelBox: Widgets.ListElement;
  public readonly userBox: Widgets.ListElement;
  public readonly contentBox: Widgets.Log;
  public readonly inputBox: Widgets.TextboxElement;

  constructor(public readonly tui: SlackTUI) {
    this.screen = Blessed.screen({
      title: 'slack-tui',
      smartCSR: true,
      fullUnicode: true,
      dockBorders: true,
    });

    this.screen.append(
      this.teamBox = Blessed.list({
        top: 0,
        left: 0,
        width: '25%',
        height: '25%+1',
        tags: true,
        border: { type: 'line' },
        label: ' Teams ',
        style: {
          selected: { bg: 'red' },
          // @ts-ignore FIXME
          border: { fg: '#f0f0f0' },
          focus: { border: { fg: '#ff0000' } },
        },
        keys: true,
      }),
    );
    this.screen.append(
      this.channelBox = Blessed.list({
        top: '25%',
        left: 0,
        width: '25%',
        height: '25%+1',
        tags: true,
        border: { type: 'line' },
        style: {
          // @ts-ignore FIXME
          border: { fg: '#f0f0f0' },
          focus: { border: { fg: '#ff0000' } },
          selected: { bg: 'red' },
        },
        label: ' Channels ',
        keys: true,
      }),
    );
    this.screen.append(
      this.userBox = Blessed.list({
        top: '50%',
        left: 0,
        width: '25%',
        height: '50%',
        tags: true,
        border: { type: 'line' },
        style: {
          // @ts-ignore FIXME
          border: { fg: '#f0f0f0' },
          focus: { border: { fg: '#ff0000' } },
          selected: { bg: 'red' },
        },
        label: ' Users ',
        keys: true,
      }),
    );
    this.screen.append(
      this.contentBox = Blessed.log({
        top: 0,
        left: '25%',
        width: '75%',
        height: '80%+1',
        content: [
          '='.repeat(32),
          '{green-bg}Welcome to SlackTUI!{/green-bg}',
          'Use {red-fg}Tab{/red-fg} key to move box focus.',
          'Use cursor keys to choose item.',
          '='.repeat(32),
        ].join('\n'),
        tags: true,
        border: { type: 'line' },
        style: {
          // @ts-ignore FIXME
          focus: { border: { fg: '#ff0000' } },
          border: { fg: '#f0f0f0' },
        },
        keys: true,
        scrollable: true,
      }),
    );
    this.screen.append(
      this.inputBox = Blessed.textbox({
        top: '80%',
        left: '25%',
        width: '75%',
        height: '20%+1',
        content: 'Hello {bold}world{/bold}!',
        tags: true,
        border: { type: 'line' },
        style: {
          // @ts-ignore FIXME
          focus: { border: { fg: '#ff0000' } },
          border: { fg: '#f0f0f0' },
          fg: '#f0f0f0',
        },
        keys: true,
      }),
    );

    this.inputBox.on('submit', (text) => {
      this.inputBox.clearValue();
      this.inputBox.cancel();
      this.tui.sendMessage(text);
    });

    this.teamBox.on('select', (el, selected) => {
      const teamName = toCanonicalName(el.getText());
      this.tui.focusTeamByName(teamName);
    });

    this.channelBox.on('select', (el, selected) => {
      this.tui.focusedTeam.selectChannel(el.getText());
    });

    this.userBox.on('select', (el, selected) => {
      if ( this.tui.focusedTeam ) {
        const user: SlackUser = this.tui.focusedTeam.userList[ selected ];
        if ( user ) this.tui.focusedTeam.openIM(user.id, user.name);
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
