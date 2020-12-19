import { WebClient } from '@slack/web-api';

import { Configuration } from './configuration';
import { SlackChannel, SlackConversation, SlackDM } from './conversation';
import { SlackTUI } from './tui';
import { SlackUser } from './user';
import { createLogger, Logger, toCanonicalName } from './util';

export class SlackTeam {
  private isNotificationSuppressed: boolean = false;

  public readonly name: string;
  public readonly token: string;
  public readonly log: Logger;
  private readonly client: WebClient;

  /** @deprecated TODO: Remove */
  public connection;

  public currentConversation: SlackConversation;
  public conversationMap: Map<String, SlackConversation> = new Map();

  /** @deprecated */
  public channelMap: Map<String, SlackChannel>;
  public userMap: Map<String, SlackUser> = new Map();

  constructor(private readonly tui: SlackTUI, config: Configuration.TeamTokenEntry) {
    this.name = config.name;
    this.token = config.token;
    this.client = new WebClient(config.token);

    this.log = createLogger(tui);
  }

  async load() {
    await Promise.all([
      this.updateChannelList(),
      this.updateUserList(),
    ]);
  }

  async selectChannel(channelName: string) {
    const name = toCanonicalName(channelName);
    const conversation = this.getChannelByName(name);
    if ( conversation ) {
      await conversation.updateContent();
      this.currentConversation = conversation;
    }
  }

  updateChannelListView() {
    if ( !this.isUpdatingInfo() && this.isFocused() ) {
      const channelSelectorList = this.channelList.map(({ name, unreadCount }) => {
        return unreadCount > 0 ? `${ name } (${ unreadCount })` : name;
      });
      // @ts-ignore
      this.tui.view.channelBox.setItems(channelSelectorList);
      this.tui.view.screen.render();
    }
  }

  async sendMessage(text: string) {
    await this.currentConversation?.postMessage(text);
  }

  async postMessage(channel, text) {
    if ( text?.trim() ) {
      this.isNotificationSuppressed = true;
      await this.client.chat.postMessage({ text, channel, as_user: true });
      this.isNotificationSuppressed = false;
    }
  }

  async updateContent(id: string, nameForId: string) {
    const content = this.tui.view.contentBox;

    content.setContent('');
    content.setLabel(` ${ this.name }/${ nameForId } `);
    content.log(`Loading ${ nameForId }(${ id }) ...`);

    const res = await this.client.conversations.history({ channel: id });

    if ( res.ok ) {
      const messages = (res.messages as any[])
        .map(({ user, text }) => `${ this.getUserName(user) }: ${ text }`)
        .reverse();
      content.setContent('');
      content.log(messages.join('\n'));
    } else {
      content.log('Failed: ' + JSON.stringify(res) + '\n');
    }
  }

  // TODO: Opening a conversation should support multiple user IDs (for MPIM support)
  async openIM(id: string, name: string) {
    const view = this.tui.view;

    view.contentBox.setContent('');
    view.contentBox.setLabel(` ${ this.name }/@${ name } `);
    view.contentBox.log(`Opening IM with @${ name } (${ id })`);

    const data = await this.client.conversations.open({ users: id });

    if ( data.ok ) {
      const { id: channelId } = data.channel as any;
      this.currentConversation = new SlackDM(this, channelId, name);
      await this.currentConversation.updateContent();
    } else {
      view.contentBox.log('Failed: ' + JSON.stringify(data) + '\n');
    }
  }

  getConversationById<TConversation extends SlackConversation = SlackConversation>(id: string): TConversation {
    return this.conversationMap.get(id) as TConversation;
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

  get conversationList() {
    return Array.from(this.conversationMap.values());
  }

  get channelList(): SlackChannel[] {
    return this.conversationList
      .filter(conversation => conversation instanceof SlackChannel) as SlackChannel[];
  }

  get userList() {
    return Array.from(this.userMap.values());
  }

  get userSelectorList() {
    return this.userList.map(({ name }) => `@${ name }`);
  }

  private async updateUserList() {
    const res = await this.client.users.list();
    if ( res.ok ) {
      this.userMap = (res.members as any[]).reduce((map, { id, name }) => {
        map.set(id, new SlackUser(this, id, name));
        return map;
      }, new Map());
      this.tui.requestUpdateUserList(this);
    }
  }

  private async updateChannelList() {
    const { ok, channels } = await this.client.conversations.list();
    if ( ok ) {
      const box = this.tui.view.contentBox;
      this.conversationMap.clear();

      for ( const data of channels as any[] ) {
        const conversation = this.deserializeConversation(data);
        await conversation.updateInfo(this.client);

        this.conversationMap.set(conversation.id, conversation);
      }

      this.updateChannelListView();
    }
  }

  private deserializeConversation(conversation): SlackConversation {
    if ( conversation.is_channel || conversation.is_group )
      return new SlackChannel(this, conversation.id, conversation.name);
    if ( conversation.is_im || conversation.is_mpim )
      return new SlackDM(this, conversation.id, conversation.name);
  }
}
