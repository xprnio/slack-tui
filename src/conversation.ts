import { SlackTeam } from './team';

export interface SlackConversation {
  updateContent();

  postMessage(text: string);

  getID(): string;
}

export class SlackChannel implements SlackConversation {
  team: SlackTeam;
  id: string;
  name: string;
  unread_count: number;
  private _isUpdatingInfo: boolean = false;

  constructor(team: SlackTeam, id: string, name: string) {
    this.team = team;
    this.id = id;
    this.name = name;
  }

  isUpdatingInfo() {
    return this._isUpdatingInfo;
  }

  updateInfo(connection) {
    this._isUpdatingInfo = true;
    connection.reqAPI('channels.info', { channel: this.id }, (data) => {
      this._isUpdatingInfo = false;
      if ( !data.ok ) return;
      this.name = data.channel.name;
      this.unread_count = data.channel.unread_count;
      this.team.updateChannelListView();
    });
  }

  updateContent() {
    this.team.updateContent(this.id, '#' + this.name);
  }

  postMessage(text: string) {
    this.team.postMessage(this.id, text);
  }

  getID() {
    return this.id;
  }
}

export class SlackDM implements SlackConversation {
  team: SlackTeam;
  id: string;
  name: string;

  constructor(team: SlackTeam, id: string, name: string) {
    this.team = team;
    this.id = id;
    this.name = name;
  }

  updateContent() {
    this.team.updateContent(this.id, '@' + this.name);
  }

  postMessage(text: string) {
    this.team.postMessage(this.id, text);
  }

  getID() {
    return this.id;
  }
}
