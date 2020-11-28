import notifier from 'node-notifier';
import SlackAPI from 'slackbotapi';

import { SlackChannel, SlackConversation, SlackDM } from './conversation';
import { SlackUser } from './user';
import { SlackTUI } from './tui';
import { SlackRTMData } from './rtm';
import { createLogger, Logger } from './util';

export class SlackTeam {
  name: string = '';
  connection: SlackAPI;
  channelList: SlackChannel[] = [];
  currentConversation: SlackConversation;
  token: string;
  userList: SlackUser[];
  tui: SlackTUI;
  isNotificationSuppressed: boolean = false;
  log: Logger;
  userSelectorList: string[];

  constructor(config, tui: SlackTUI) {
    this.tui = tui;
    this.name = config[ 1 ];
    this.token = config[ 0 ];
    this.log = createLogger(tui);

    this.connection = new SlackAPI({
      'token': config[ 0 ],
      'logging': false,
      'autoReconnect': true,
    });

    this.setRTMHandler();
    this.updateChannelList();
    this.updateUserList();
  }

  private static getCanonicalChannelName(str: string) {
    return str.replace(/\(.*\)/g, '');
  }

  setRTMHandler() {
    this.connection.on('message', (data) => {
      this.tui.view.contentBox.log(JSON.stringify(data) + '\n');
      const channel_id = SlackRTMData.getChannelId(data);
      if ( this.currentConversation && this.currentConversation.getID() === channel_id ) {
        // TODO: Improve performance (change to append new message only)
        this.currentConversation.updateContent();
      }
      if ( !this.isNotificationSuppressed ) {
        notifier.notify('New message on ' + this.name);
      }
    });
  }

  updateChannelListView() {
    for ( const ch of this.channelList ) {
      if ( ch.isUpdatingInfo() ) return;
    }
    this.log('done: ' + this.name);
    const channelSelectorList = [];
    for ( const ch of this.channelList ) {
      channelSelectorList.push(ch.name + '(' + ch.unread_count + ')');
    }
    if ( !this.tui.isTeamFocused(this) ) return;
    this.tui.view.channelBox.setItems(channelSelectorList);
    this.tui.view.screen.render();
  }

  getChannelById(channelId: string): SlackChannel {
    for ( const ch of this.channelList ) {
      if ( ch.id == channelId ) return ch;
    }
    return null;
  }

  getChannelByName(channelName: string): SlackChannel {
    for ( const ch of this.channelList ) {
      if ( ch.name == channelName ) return ch;
    }
    return null;
  }

  selectChannel(channelName: string) {
    const ch = this.getChannelByName(SlackTeam.getCanonicalChannelName(channelName));
    if ( !ch ) return;
    this.currentConversation = ch;
    ch.updateContent();
  }

  getUserName(userID: string) {
    for ( const u of this.userList ) {
      if ( u.id === userID ) return u.name;
    }
    return null;
  }

  sendMessage(text: string) {
    if ( !this.currentConversation ) return;
    this.currentConversation.postMessage(text);
  }

  postMessage(channelID, text) {
    const data: any = {};
    data.text = text;
    data.channel = channelID;
    data.as_user = true;

    this.isNotificationSuppressed = true;
    setTimeout(() => { this.isNotificationSuppressed = false; }, 1000);
    // APIのchat.postMessageを使ってメッセージを送信する
    this.connection.reqAPI('chat.postMessage', data);
  }

  updateContent(id, name_for_id) {
    const view = this.tui.view;
    const connection = this.connection;
    view.contentBox.setContent('');
    view.contentBox.setLabel(this.name + '/' + name_for_id);
    view.contentBox.log(`Loading ${ name_for_id }(${ id }) ...`);
    connection.reqAPI('conversations.history', { channel: id }, (data) => {
      if ( !data.ok ) {
        view.contentBox.log('Failed: ' + JSON.stringify(data) + '\n');
        return;
      }
      view.contentBox.setContent('');
      const messages = data.messages.map((e) => {
        const head = (this.getUserName(e.user) + '          ').substr(0, 10);
        return head + ':' + e.text;
      }).reverse();
      view.contentBox.log(messages.join('\n'));
    });
  }

  openIM(user_id, name_for_id) {
    const view = this.tui.view;
    const connection = this.connection;
    view.contentBox.setContent('');
    view.contentBox.setLabel(this.name + '/@' + name_for_id);
    view.contentBox.log(`Opening IM with @${ name_for_id }(${ user_id }) ...`);
    connection.reqAPI('im.open', { user: user_id }, (data) => {
      if ( !data.ok ) {
        view.contentBox.log('Failed: ' + JSON.stringify(data) + '\n');
        return;
      }
      const channel_id = data.channel.id;
      this.currentConversation = new SlackDM(this, channel_id, name_for_id);
      this.currentConversation.updateContent();
    });
  }

  private updateUserList() {
    this.connection.reqAPI('users.list', { token: this.token }, (data) => {
      if ( !data.ok ) return;
      this.userList = data.members.map(e => new SlackUser(this, e.id, e.name));
      this.userSelectorList = [];
      for ( const u of this.userList ) {
        this.userSelectorList.push('@' + u.name);
      }
      this.tui.requestUpdateUserList(this);
    });
  }

  private updateChannelList() {
    this.connection.reqAPI('channels.list', { token: this.token }, (data) => {
      if ( !data.ok ) return;
      this.channelList = data.channels.map((e) => {
        const ch = new SlackChannel(this, e.id, e.name);
        ch.updateInfo(this.connection);
        return ch;
      });
      this.updateChannelListView();
    });
  }
}
