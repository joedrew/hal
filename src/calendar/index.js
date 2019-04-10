/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  A bot that ...
//
// Dependencies:
//   - moment
//   - icalendar
//   - underscore
//
// Configuration:
//   EXPRESS_URL
//   HUBOT_CALENDAR_VERIFICATION_TOKEN
//   HUBOT_CALENDAR_MAP
//       "vacation": [
//         {
//           "chapter": {
//             "id:": "C024GR3KC",
//             "name": "Everyone"
//           },
//           "url": "vacationcalendarurl"
//         }
//       ]
//     }
//
// Commands:
//   None
//
// Author:
//   ndaversa

const _ = require("underscore");
const s = require("underscore.string");
const moment = require("moment");
const icalendar = require('icalendar');

const Bot = require("../bot");
const SlackButtons = require("../bot/slackbuttons");
const Server = require("../bot/server");
const Config = require("../config");
const Utils = require("../utils");

class CalendarBot extends Bot {
  static initClass() {
    this.include(SlackButtons);
    this.include(Server); //Doing auth via token in URL
  
    this.prototype.credentials = 
      {token: Config.slack.token};
  }

  constructor(robot) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.match(/return (?:_assertThisInitialized\()*(\w+)\)*;/)[1];
      eval(`${thisName} = this;`);
    }
    this.robot = robot;
    if (!(this instanceof CalendarBot)) { return new CalendarBot(this.robot); }
    this.requests = {};

    this.commands = [{
      regex: /calendar link for <?@([\w._-]*)>?/i,
      name: "requestCalendarLinkForGroup"
    }
    ];

    this.endpoints = [{
      path: "/hubot/calendar/:token/:usergroup/:type",
      type: "get",
      func: this.getCalendarForGroupType
    }
    ];

    this.slackButtons = [{
      name: "type",
      value: "vacation",
      text: "Vacation",
      type: "button",
      style: "primary",
      func: this.onTypeButton
    }
    ];
    super(...arguments);
  }

  isAuthorized() { return true; }

  queueRequest(context) {
    const id = Date.now();
    this.requests[id] = context;
    return id;
  }

  dequeueRequest(id) {
    const rc = this.requests[id];
    delete this.requests[id];
    return rc;
  }

  onTypeButton(payload, action) {
    const { attachments } = payload.original_message;
    attachments.shift(); // Remove the buttons

    const details = this.dequeueRequest(payload.callback_id);
    if (!details) {
      return attachments.unshift({text: "Sorry I was unable to process your request :sadpanda:"});
    }

    const link = this.generateCalendarLinkForGroup(details.usergroup, action.value);
    switch (action.value) {
      case "vacation":
        return attachments.unshift({text: `Here is a calendar URL that includes \
the ${s.capitalize(action.value)} schedule for everyone in \
<!subteam^${details.usergroup.id}|${details.usergroup.handle}>:\n\n \
${link}\n\n \
Copy this URL and import it into your calendar solution of choice :smile:\
`
        });
    }
  }

  generateCalendarLinkForGroup(usergroup, type) {
    return `${Config.server.url}/hubot/calendar/${Config.calendar.verification.token}/${usergroup.id}/${type}`;
  }

  requestCalendarLinkForGroup(context) {
    const [ __, handle ] = Array.from(context.match);

    return Utils.getGroupInfo(handle)
    .then(usergroup => {
      const id = this.queueRequest({
        context,
        usergroup
      });

      return this.send(context, {
        text: "What kind of calendar link do you want?",
        attachments: [ this.buttonsAttachment(id, {name: "type"}) ]
      });
  })
    .catch(error => {
      return this.send(context,
        {text: `Sorry I was unable to find the @${handle} usergroup`});
    });
  }

  getCalendarForGroupType(req, res) {
    if (Config.calendar.verification.token !== req.params.token) { return res.status(404).send("Not a valid calendar"); }
    if (Config.calendar.map[req.params.type] == null) { return res.status(400).send("Invalid calendar type"); }

    const calendar = new icalendar.iCalendar();
    calendar.setProperty("PRODID", `-//HAL//${this.robot.name}//EN`);

    let users = null;
    return Utils.getGroupInfo(req.params.usergroup)
    .then(function(usergroup) {
      calendar.setProperty("X-WR-CALNAME", `${s.capitalize(req.params.type)}: @${usergroup.handle} (${usergroup.name})`);
      return Utils.getUsersInGroup(req.params.usergroup);}).then(function(_users) {
      users = _users;
      return Utils.getCalendarsFromURLs(Config.calendar.map[req.params.type].map(c => c.url));}).then(function(calendars) {
      for (let c of Array.from(calendars)) {
        c.events().map(function(event) {
          let summary = event.getPropertyValue("SUMMARY");
          if (req.params.type === "vacation") { summary = summary.split(/\(.*\)/)[0].trim(); }
          const user = Utils.fuzzyFindChatUser(summary);
          if (user && _(users).findWhere({id: user.id})) {
            return calendar.addComponent(event);
          }
        });
      }
      return res.header("Content-Type","text/calendar; charset=UTF-8")
      .send(calendar.toString());}).catch(error => {
      this.robot.logger.error(error);
      return res.status(404).send("Invalid group specified");
    });
  }
}
CalendarBot.initClass();

module.exports = CalendarBot;
