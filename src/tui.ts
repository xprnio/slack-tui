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

    Promise.resolve()
      .then(() => this.view.contentBox.log(`{white-fg}Loading...{/white-fg}`))
      .then(() => this.refreshTeamList())
      .then(() => this.view.contentBox.log(`{green-fg}Loading complete!{/green-fg}`))
      .then(() => this.view.contentBox.log(`{white-fg}To begin, select a team from the left{/white-fg}`))
      .catch(err => this.view.contentBox.log(`Error: ${ err.message || err }`));
  }

  async refreshTeamList() {
    const {
      contentBox: content,
      teamBox: teams,
      screen,
    } = this.view;

    try {
      const selectors = [];

      for ( const { name, token } of this.tokenList ) {
        const team = new SlackTeam(this, { name, token });
        this.teamDict.set(name, team);
        await team.load();
        selectors.push(`${ name }(*)`);
      }
      teams.setItems(selectors);
      screen.render();
    } catch ( e ) {
      content.log(`Error: failed to refresh team list`);
      content.log(e.message + '\n');
    }
  }

  isTeamFocused(team: SlackTeam) {
    return this.focusedTeam === team;
  }

  requestUpdateUserList(team: SlackTeam) {
    if ( team.isFocused() ) {
      // @ts-ignore
      this.view.userBox.setItems(team.userSelectorList);
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
      this.focusTeam(this.teamDict.get(teamName));
    }
  }

  focusTeam(team: SlackTeam) {
    this.focusedTeam = team;
    this.focusedTeam.updateChannelListView();
    this.requestUpdateUserList(this.focusedTeam);
  }

  async sendMessage(text: string) {
    if ( this.focusedTeam ) {
      await this.focusedTeam.sendMessage(text);
    }
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
          // @ts-ignore FIXME
          border: { fg: 'white' },
          focus: { border: { fg: 'green' } },
          selected: { fg: 'white', bg: 'green' },
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
          border: { fg: 'white' },
          focus: { border: { fg: 'green' } },
          selected: { fg: 'white', bg: 'green' },
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
          border: { fg: 'white' },
          focus: { border: { fg: 'green' } },
          selected: { fg: 'white', bg: 'green' },
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
          '='.repeat(40),
          '{white-fg}Welcome to SlackTUI!{/white-fg}',
          'Use {green-fg}Tab{/green-fg} key to move box focus.',
          'Use {green-fg}cursor keys{/green-fg} to choose item.',
          '='.repeat(40),
        ].map((row) => {
          const text = row.replace(/{\/?[a-z\-]+}/ig, '');
          const width = Math.floor(parseInt(this.screen.width as string) * 0.75);
          const room = width - text.length;
          const padding = Math.floor(room / 2);
          return ' '.repeat(padding) + row;
        }).join('\n'),
        tags: true,
        border: { type: 'line' },
        style: {
          // @ts-ignore FIXME
          border: { fg: 'white' },
          focus: { border: { fg: 'green' } },
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
          focus: { border: { fg: 'green' } },
          border: { fg: 'white' },
          fg: 'white',
        },
        keys: true,
      }),
    );

    this.inputBox.on('submit', async (text) => {
      this.inputBox.clearValue();
      this.inputBox.cancel();
      await this.tui.sendMessage(text);
    });

    this.teamBox.on('select', async (el, selected) => {
      if ( el ) {
        const teamName = toCanonicalName(el.getText());
        this.tui.focusTeamByName(teamName);
      }
    });

    this.channelBox.on('select', async (el, selected) => {
      const name = el?.getText();
      if ( name ) await this.tui.focusedTeam?.selectChannel(name);
    });

    this.userBox.on('select', async (el, selected) => {
      if ( this.tui.focusedTeam ) {
        const user: SlackUser = this.tui.focusedTeam.userList[ selected ];
        if ( user ) await this.tui.focusedTeam.openIM(user.id, user.name);
      }
    });

    this.screen.key([ 'C-c' ], async (ch, key) => {
      return process.exit(0);
    });

    this.screen.key([ 't' ], async (ch, key) => {
      this.teamBox.focus();
    });

    this.teamBox.key([ 'tab' ], async (ch, key) => {
      this.channelBox.focus();
    });
    this.channelBox.key([ 'tab' ], async (ch, key) => {
      this.userBox.focus();
    });
    this.userBox.key([ 'tab' ], async (ch, key) => {
      this.inputBox.focus();
    });
    this.inputBox.key([ 'tab' ], async (ch, key) => {
      this.contentBox.focus();
    });
    this.contentBox.key([ 'tab' ], async (ch, key) => {
      this.teamBox.focus();
    });

    this.teamBox.focus();
    this.screen.render();
  }
}
