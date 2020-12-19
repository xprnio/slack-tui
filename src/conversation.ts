import { WebClient } from '@slack/web-api';
import { SlackTeam } from './team';

export abstract class SlackConversation {
  protected isUpdating: boolean = false;
  public unreadCount: number = 0;

  protected constructor(
    public readonly team: SlackTeam,
    public readonly id: string,
    public name: string,
  ) {}

  async updateInfo(client: WebClient) {
    this.isUpdating = true;
    const res = await client.conversations.info({ channel: this.id });
    this.isUpdating = false;

    if ( res.ok ) {
      const channel = res.channel as any;
      this.name = channel.name;
      this.unreadCount = channel.unread_count;
      this.team.updateChannelListView();
    }
  }

  async postMessage(text: string) {
    await this.team.postMessage(this.id, text);
  }

  abstract updateContent(): Promise<void>;

  isUpdatingInfo() {
    return this.isUpdating;
  }
}

export class SlackChannel extends SlackConversation {
  constructor(
    public readonly team: SlackTeam,
    public readonly id: string,
    public name: string,
  ) { super(team, id, name); }

  async updateContent() {
    await this.team.updateContent(this.id, '#' + this.name);
  }
}

export class SlackDM extends SlackConversation {
  constructor(
    public readonly team: SlackTeam,
    public readonly id: string,
    public name: string,
  ) { super(team, id, name); }

  async updateContent() {
    await this.team.updateContent(this.id, '@' + this.name);
  }
}
