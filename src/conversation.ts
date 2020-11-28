import { SlackTeam } from './team';

export interface SlackConversation {
  readonly id: string;

  updateContent();

  postMessage(text: string);
}

export class SlackChannel implements SlackConversation {
  public unreadCount: number;
  private isUpdating: boolean = false;

  constructor(
    public readonly team: SlackTeam,
    public readonly id: string,
    public name: string,
  ) { }

  updateInfo(connection) {
    this.isUpdating = true;
    connection.reqAPI('channels.info', { channel: this.id }, (data) => {
      this.isUpdating = false;
      if ( data.ok ) {
        this.name = data.channel.name;
        this.unreadCount = data.channel.unread_count;
        this.team.updateChannelListView();
      }
    });
  }

  updateContent() {
    this.team.updateContent(this.id, '#' + this.name);
  }

  postMessage(text: string) {
    this.team.postMessage(this.id, text);
  }

  isUpdatingInfo() {
    return this.isUpdating;
  }
}

export class SlackDM implements SlackConversation {
  constructor(
    public readonly team: SlackTeam,
    public readonly id: string,
    public readonly name: string,
  ) { }

  updateContent() {
    this.team.updateContent(this.id, '@' + this.name);
  }

  postMessage(text: string) {
    this.team.postMessage(this.id, text);
  }
}
