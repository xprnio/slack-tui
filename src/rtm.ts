export class SlackRTMData {
  static getChannelId(data) {
    return data.type === 'message' ? data.channel : null;
  }
}
