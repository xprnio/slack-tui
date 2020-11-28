export class SlackRTMData {
  static getChannelId(data) {
    if ( data.type === 'message' ) {
      return data.channel;
    }
    return null;
  }
}
