import * as Blessed from 'blessed';
import Notifier from 'node-notifier';
// TODO: Replace with @slack/rtm-api
import SlackAPI from 'slackbotapi';

import { Configuration } from './configuration';
import { SlackChannel, SlackConversation, SlackDM } from './conversation';
import { SlackRTMData } from './rtm';
import { SlackTUI } from './tui';
import { SlackUser } from './user';
import { createLogger, Logger, toCanonicalName } from './util';

export class SlackTeam {
  private isNotificationSuppressed: boolean = false;

  public readonly name: string;
  public readonly token: string;
  public readonly log: Logger;

  public connection: SlackAPI;
  public currentConversation: SlackConversation;
  public channelMap: Map<String, SlackChannel>;
  public userMap: Map<String, SlackUser>;

  constructor(private readonly tui: SlackTUI, config: Configuration.TeamTokenEntry) {
    this.name = config.name;
    this.token = config.token;

    this.connection = new SlackAPI({ token: this.token, logging: false, autoReconnect: true });
    this.log = createLogger(tui);

    this.setRTMHandler();
    this.updateChannelList();
    this.updateUserList();
  }

  setRTMHandler() {
    this.connection.on('message', (data) => {
      const channelId = SlackRTMData.getChannelId(data);
      this.tui.view.contentBox.log(JSON.stringify(data) + '\n');

      if ( this.currentConversation?.id === channelId ) {
        // TODO: Improve performance (change to append new message only)
        this.currentConversation.updateContent();
      }
      if ( !this.isNotificationSuppressed ) Notifier.notify(`New message on ${ this.name }`);
    });
  }

  updateChannelListView() {
    if ( !this.isUpdatingInfo() && this.isFocused() ) {
      const channelSelectorList = this.channelList.map(({ name, unreadCount }) => {
        return Blessed.text({ content: `${ name } (${ unreadCount })` });
      });

      this.log(`done: ${ this.name }`);
      this.tui.view.channelBox.setItems(channelSelectorList);
      this.tui.view.screen.render();
    }
  }

  selectChannel(channelName: string) {
    const name = toCanonicalName(channelName);
    const channel = this.getChannelByName(name);
    if ( channel ) {
      channel.updateContent();
      this.currentConversation = channel;
    }
  }

  sendMessage(text: string) {
    this.currentConversation?.postMessage(text);
  }

  postMessage(channel, text) {
    this.isNotificationSuppressed = true;
    this.connection.reqAPI('chat.postMessage', { text, channel, as_user: true });
    setTimeout(() => {
      this.isNotificationSuppressed = false;
    }, 1000);
  }

  updateContent(id: string, nameForId: string) {
    const { view } = this.tui;

    view.contentBox.setContent('');
    view.contentBox.setLabel(this.name + '/' + nameForId);
    view.contentBox.log(`Loading ${ nameForId }(${ id }) ...`);

    this.connection.reqAPI('conversations.history', { channel: id }, (data) => {
      if ( data.ok ) {
        const messages = data.messages.map(({ user, text }) => `${ this.getUserName(user) }: ${ text }`)
          .reverse();
        view.contentBox.setContent('');
        view.contentBox.log(messages.join('\n'));
      } else {
        view.contentBox.log('Failed: ' + JSON.stringify(data) + '\n');
      }
    });
  }

  openIM(id: string, name: string) {
    const view = this.tui.view;

    view.contentBox.setContent('');
    view.contentBox.setLabel(`${ this.name }/@${ name }`);
    view.contentBox.log(`Opening IM with @${ name }(${ id }) ...`);

    this.connection.reqAPI('im.open', { user: id }, (data) => {
      if ( data.ok ) {
        this.currentConversation = new SlackDM(this, data.channel.id, name);
        this.currentConversation.updateContent();
      } else {
        view.contentBox.log('Failed: ' + JSON.stringify(data) + '\n');
      }
    });
  }

  getChannelById(channelId: string): SlackChannel {
    return this.channelMap.get(channelId);
  }

  getChannelByName(channelName: string): SlackChannel {
    return this.channelList.find(
      channel => channel.name === channelName,
    );
  }

  getUserName(userID: string): string {
    const user = this.userMap.get(userID);
    return user?.name ?? null;
  }

  isUpdatingInfo(): boolean {
    return this.channelList.some(channel => channel.isUpdatingInfo());
  }

  isFocused() {
    return this.tui.focusedTeam === this;
  }

  get channelList() {
    return Array.from(this.channelMap.values());
  }

  get userList() {
    return Array.from(this.userMap.values());
  }

  get userSelectorList() {
    return this.userList.map(({ name }) => `@${ name }`);
  }

  private updateUserList() {
    this.connection.reqAPI('users.list', { token: this.token }, (data) => {
      if ( data.ok ) {
        this.userMap = data.members.reduce((map, { id, name }) => {
          map.set(id, new SlackUser(this, id, name));
          return map;
        }, new Map());
        this.tui.requestUpdateUserList(this);
      }
    });
  }

  private updateChannelList() {
    const { token } = this;
    this.connection.reqAPI('channels.list', { token }, (data) => {
      if ( data.ok ) {
        this.channelMap = data.channels.reduce((map: Map<String, SlackChannel>, e) => {
          const channel = new SlackChannel(this, e.id, e.name);
          channel.updateInfo(this.connection);
          map.set(channel.id, channel);
          return map;
        }, new Map());
        this.updateChannelListView();
      }
    });
  }
}
