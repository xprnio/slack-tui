import { SlackTeam } from './team';

export class SlackUser {
  constructor(
    public readonly team: SlackTeam,
    public readonly id: string,
    public readonly name: string,
  ) { }
}
