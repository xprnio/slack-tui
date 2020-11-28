# @xprnio/slack-tui

### This project is currently in development
Due to the deprecation of Slack's Real-Time Messaging API, work has begun in rewriting this app using
the Web API (along with other changes).

From the [Node Slack SDK documentation](https://slack.dev/node-slack-sdk/rtm-api):
> Note: RTM isn't available for modern scoped apps anymore. We recommend using the Events API and Web API instead.
> If you need to use RTM (possibly due to corporate firewall limitations), you can do so by creating a legacy scoped app.
> If you have an existing RTM app, do not update its scopes as it will be updated to a modern scoped app
> and stop working with RTM.

Because of this, (until work on the OAuth flow is complete) running this version of Slack-TUI requires
[a new Slack app to be created](https://api.slack.com/apps?new_app=1),
and a user OAuth token to be created with the following permission scopes:

```
# For getting team and user info
team:read
users:read

# For listing conversations
channels:history
channels:read
groups:history
groups:read
im:history
im:read

# For creating and interacting with conversations
chat:write
im:write
```
