
class SlackTeam
{
	static SlackAPI = require('slackbotapi');
	name: string = "";
	connection;
	channelList;
	currentChannelName;
	token: string;
	userList;
	tui: SlackTUI;
	constructor(config, tui: SlackTUI)
	{
		this.tui = tui;
		this.name = config[1];
		this.token = config[0];
		this.connection = new SlackTeam.SlackAPI({
			"token": config[0],
			'logging': false,
			'autoReconnect': true
		});
		this.setRTMHandler();
		this.updateChannelList();
		this.updateUserList();
	}
	setRTMHandler() {
		this.connection.on('message', (data) => {
			// TODO: Improve performance (change to append new message only)
			if(!this.tui.isTeamFocused(this)) return;
			this.selectChannel(this.currentChannelName);
		});
	}
	channelSelectorList;
	private updateChannelList(){
		this.connection.reqAPI('channels.list', {token: this.token}, (data) => {
			if(!data.ok) return;
			this.channelList = data.channels.map(function(e){
				return [e.name, e.id];
			});
			this.channelSelectorList = [];
			for(var t of this.channelList){
				this.channelSelectorList.push(t[0]);
			}
			this.tui.requestUpdateChannelList(this);
		});
	}
	userSelectorList;
	private updateUserList(){
		this.connection.reqAPI('users.list', {token: this.token}, (data) => {
			if(!data.ok) return;
			this.userList = data.members.map(function(e){
				return [e.name, e.id];
			});
			this.userSelectorList = [];
			for(var t of this.userList){
				this.userSelectorList.push(t[0]);
			}
			this.tui.requestUpdateUserList(this);
		});
	}
	selectChannel(channelName: string){
		var chid = null;
		for(var t of this.channelList){
			if(t[0] == channelName){
				chid = t[1];
			}
		}
		if(!chid) return;
		this.currentChannelName = channelName;
		this.tui.requestClearContentBox(this);
		this.tui.requestSetLabelOfContentBox(this, this.name + "/" + channelName);
		this.tui.requestLogToContentBox(this, "Loading...");
		this.connection.reqAPI('channels.history', {channel: chid}, (data) => {
			if(!data.ok) return;
			this.tui.requestClearContentBox(this);
			var messages = data.messages.map((e) => {
				return (this.getUserName(e.user) + "          ").substr(0, 10) + ":" + e.text;
			}).reverse();
			this.tui.requestLogToContentBox(this, messages.join("\n"));
		});
	}
	getUserName(userID: string){
		for(var u of this.userList){
			if(u[1] === userID) return u[0];
		}
		return null;
	}
}

class SlackTUIView
{
	teamBox;
	channelBox;
	userBox;
	inputBox;
	contentBox;
	screen;
	tui;
	constructor(tui: SlackTUI){
		this.tui = tui;
		const blessed = require('blessed');

		// Create a screen object.
		this.screen = blessed.screen({
			smartCSR: true,
			fullUnicode: true,
			dockBorders: true,
		});

		this.screen.title = 'slack-tui';

		this.teamBox = blessed.list({
			top: 0,
			left: 0,
			width: '25%',
			height: '25%+1',
			tags: true,
			border: {
				type: 'line'
			},
			label: ' Teams ',
			style: {
				border: {
					fg: '#f0f0f0'
				},
				selected: {
					bg: 'red'
				},
				focus: {
					border: {
						fg: '#00ff00'
					},
				},
			},
			keys: true,
		});
		this.screen.append(this.teamBox);


		this.channelBox = blessed.list({
			top: '25%',
			left: 0,
			width: '25%',
			height: '25%+1',
			tags: true,
			border: {
				type: 'line'
			},
			style: {
				//fg: 'white',
				//bg: 'magenta',
				border: {
					fg: '#f0f0f0'
				},
				selected: {
					bg: 'red'
				},
				focus: {
					border: {
						fg: '#00ff00'
					},
				},
			},
			label: ' Channels ',
			keys: true,
		});
		this.screen.append(this.channelBox);

		this.userBox = blessed.list({
			top: '50%',
			left: 0,
			width: '25%',
			height: '50%',
			tags: true,
			border: {
				type: 'line'
			},
			style: {
				//fg: 'white',
				//bg: 'magenta',
				border: {
					fg: '#f0f0f0'
				},
				selected: {
					bg: 'red'
				},
				focus: {
					border: {
						fg: '#00ff00'
					},
				},
			},
			label: ' Users ',
			keys: true,
		});
		this.screen.append(this.userBox);

		this.contentBox = blessed.log({
			top: 0,
			left: '25%',
			width: '75%',
			height: '80%+1',
			content: `
{green-bg}Welcome to SlackTUI!{/green-bg}
Use {red-fg}Tab{/red-fg} key to move box focus.
Use cursor keys to choose item.
			`,
			tags: true,
			border: {
				type: 'line'
			},
			style: {
				border: {
					fg: '#f0f0f0'
				},
				focus: {
					border: {
						fg: '#00ff00'
					},
				},
			},
			keys: true,
			scrollable: true,
		});
		this.screen.append(this.contentBox);

		this.inputBox = blessed.textbox({
			top: '80%',
			left: '25%',
			width: '75%',
			height: '20%+1',
			content: 'Hello {bold}world{/bold}!',
			tags: true,
			border: {
				type: 'line'
			},
			style: {
				fg: 'white',
				border: {
					fg: '#f0f0f0'
				},
				focus: {
					border: {
						fg: '#00ff00'
					},
				},
			},
			keys: true,
		});
		this.screen.append(this.inputBox);

		this.inputBox.on('submit', (text) => {
			this.inputBox.clearValue();
			this.contentBox.log("send[" + text + "]"); 
		});

		this.teamBox.on('select', (el, selected) => {
			var teamName = el.getText();
			this.tui.focusTeamByName(teamName);
		});

		this.channelBox.on('select', (el, selected) => {
			//contentBox.log(el.getText());
			this.tui.focusedTeam.selectChannel(el.getText());
		});


		this.screen.key(['C-c'], (ch, key) => {
			return process.exit(0);
		});

		this.screen.key(['t'], (ch, key) => {
			this.teamBox.focus();
		});

		this.teamBox.key(['tab'], (ch, key) => {
			this.channelBox.focus();
		});
		this.channelBox.key(['tab'], (ch, key) => {
			this.inputBox.focus();
		});
		this.inputBox.key(['tab'], (ch, key) =>  {
			this.contentBox.focus();
		});
		this.contentBox.key(['tab'], (ch, key) =>  {
			this.teamBox.focus();
		});


		this.teamBox.focus();

		this.screen.render();

	}
}

class SlackTUI
{
	fs = require("fs");
	configFile = "teamlist.json";
	tokenList = [];
	teamDict: {[key: string]: SlackTeam} = {};
	private focusedTeam: SlackTeam = null;
	view: SlackTUIView;
	constructor(){
		this.view = new SlackTUIView(this);
		try{
			var fval = this.fs.readFileSync(this.configFile);
			this.tokenList = JSON.parse(fval);
		} catch(e){
			this.view.contentBox.log("Error: failed to read " + this.configFile);
		}
		this.refreshTeamList();
	}
	refreshTeamList(){
		var teamSelectorList = [];
		for(var t of this.tokenList){
			teamSelectorList.push(t[1]);
			var team = new SlackTeam(t, this);
			this.teamDict[t[1]] = team;
		}
		this.view.teamBox.setItems(teamSelectorList);
		this.view.screen.render();
	}
	isTeamFocused(team: SlackTeam){
		return (this.focusedTeam === team);
	}
	requestUpdateChannelList(team: SlackTeam){
		if(!this.isTeamFocused(team)) return;
		this.view.channelBox.setItems(team.channelSelectorList);
		this.view.screen.render();
	}
	requestUpdateUserList(team: SlackTeam){
		if(!this.isTeamFocused(team)) return;
		this.view.userBox.setItems(team.userSelectorList);
		this.view.screen.render();
	}
	requestLogToContentBox(team: SlackTeam, data: string){
		if(!this.isTeamFocused(team)) return;
		this.view.contentBox.log(data);
		//this.screen.render();
	}
	requestClearContentBox(team: SlackTeam){
		if(!this.isTeamFocused(team)) return;
		this.view.contentBox.setContent("");
	}
	requestSetLabelOfContentBox(team: SlackTeam, label: string){
		if(!this.isTeamFocused(team)) return;
		this.view.contentBox.setLabel(" " + label + " ");
		this.view.contentBox.render();
	}
	focusTeamByName(teamName: string){
		if(this.teamDict[teamName]){
			this.focusedTeam = this.teamDict[teamName];
		}
		this.requestUpdateChannelList(this.focusedTeam);
		this.requestUpdateUserList(this.focusedTeam);
	}

}

var slackTUI = new SlackTUI();

