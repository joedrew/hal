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
//  A bot that helps you schedule meetings
//
// Dependencies:
//   - moment
//
// Configuration:
//   HUBOT_AGORA_URL - eg. "http://localhost:5555"
//   HUBOT_MEETING_VERIFICATION_TOKEN - A token required to be passed as an Authorization Basic
//
// Commands:
//   list rooms - show all the meeting rooms
//   book a room - quickly book a meeting room for use right now
//
// Author:
//   ndaversa

const _ = require("underscore");
const moment = require("moment");

const Bot = require("../bot");
const SlackButtons = require("../bot/slackbuttons");
const Server = require("../bot/server");
const Config = require("../config");
const Utils = require("../utils");

class MeetingBot extends Bot {
  static initClass() {
    this.include(Server);
    this.include(SlackButtons);
  }

  constructor(robot) {
    super(...arguments);

    this.robot = robot;
    if (!(this instanceof MeetingBot)) { return new MeetingBot(this.robot); }
    this.commands = [{
      regex: /(room(s)? list|list rooms)/i,
      name: "listRoomsCommand"
    }
    , {
      regex: /book(?: me)? a room/i,
      name: "instantBookCommand"
    }
    ];

    this.endpoints = [{
      path: "/hubot/meeting/checkin",
      type: "post",
      func: this.postMeetingCheckin
    }
    ];

    this.requests = {};
    this.checkins = {};

    this.imHereButton = {
      name: "status",
      value: "confirm",
      text: "I'm here",
      type: "button",
      style: "primary",
      func: this.onStatusButton
    };

    this.runningLateButton = {
      name: "status",
      value: "late",
      text: "I'm running late",
      type: "button",
      func: this.onStatusButton
    };

    this.cantMakeItButton = {
      name: "status",
      value: "deny",
      text: "Can't make it",
      type: "button",
      style: "danger",
      func: this.onStatusButton
    };

    this.fifteenMinsButton = {
      name: "duration",
      value: 15,
      text: "15 minutes",
      type: "button",
      style: "primary",
      func: this.onDurationButton
    };

    this.thirtyMinsButton = {
      name: "duration",
      value: 30,
      text: "30 minutes",
      type: "button",
      func: this.onDurationButton
    };

    this.oneHourButton = {
      name: "duration",
      value: 60,
      text: "1 hour",
      type: "button",
      func: this.onDurationButton
    };

    this.slackButtons = [ this.fifteenMinsButton, this.thirtyMinsButton, this.oneHourButton, this.imHereButton, this.runningLateButton, this.cantMakeItButton ];
  }

  queueCheckin(meeting, user) {
    const id = `${Date.now()}_${user.name}`;
    this.checkins[id] = {
      meeting,
      user
    };
    return id;
  }

  queueRequest(context) {
    const id = Date.now();
    this.requests[id] = context;
    return id;
  }

  onDurationButton(payload, action) {
    const context = this.requests[payload.callback_id];
    this.bookRoom({
      context,
      duration: parseInt(action.value, 10)
    });
    return payload.original_message.attachments = [
      {text: `Attempting to book a ${action.value} minute meeting...`}
    ];
  }

  onStatusButton(payload, action) {
    const checkin = this.checkins[payload.callback_id];
    const attendees = _(checkin.meeting.attendees).without(checkin.user.email_address).map(attendee => Utils.lookupChatUserByEmail(attendee));
    const { attachments } = payload.original_message;
    attachments.shift(); // Remove the buttons

    switch (action.value) {
      case "confirm":
        return this.checkinRoom(checkin)
        .then(json => {
          return attachments.unshift({text: "I have checked you in. Thank you"});
      }).catch(error => {
          return attachments.unshift({text: "Sorry, I was unable to check you in :sadpanda:"});
        });
      case "late":
        if (attendees.length > 0) {
          this.dm(attendees, `<@${checkin.user.id}> is running late to \`${checkin.meeting.description}\``);
          return attachments.unshift({text: `I will let ${attendees.map(a => `<@${a.id}>`).join(", ")} know you are running late`});
        } else {
          return this.cancelMeeting(checkin.meeting.id)
          .then(json => {
            return attachments.unshift({text: "Okay I have cancelled this meeting since you are the only attendee"});
        }).catch(error => {
            return attachments.unshift({text: "Sorry, I was unable to cancel this meeting :sadpanda:"});
          });
        }
      case "deny":
        if (attendees.length > 0) {
          this.dm(attendees, `<@${checkin.user.id}> will not be able to attend \`${checkin.meeting.description}\``);
          return attachments.unshift({text: `I will let ${attendees.map(a => `<@${a.id}>`).join(", ")} know you will not be attending`});
        } else {
          return this.cancelMeeting(checkin.meeting.id)
          .then(json => {
            return attachments.unshift({text: "Okay I have cancelled this meeting since you are the only attendee"});
        }).catch(error => {
            return attachments.unshift({text: "Sorry, I was unable to cancel this meeting :sadpanda:"});
          });
        }
    }
  }

  roomAttachment(room) {
    return {
      fallback: room.name,
      thumb_url: room.cover,
      fields: [{
        title: "Room",
        value: room.name,
        short: true
      }
      , {
        title: "Capacity",
        value: room.capacity,
        short: true
      }
      , {
        title: "Location",
        value: room.location,
        short: false
      }
      ]
    };
  }

  checkinRoom(details) {
    return this.fetch(`${Config.meeting.server.url}/enter`, {
      method: "POST",
      body: JSON.stringify({
        beacon: details.meeting.room.beacon,
        attendee: details.user.email_address
      })
    }
    );
  }

  cancelMeeting(id) {
    return this.fetch(`${Config.meeting.server.url}/meeting`, {
      method: "DELETE",
      body: JSON.stringify({
        id: checkin.meeting.id})
    }
    );
  }

  bookRoom(details) {
    return this.fetch(`${Config.meeting.server.url}/instant`, {
      method: "POST",
      body: JSON.stringify({
        owner: details.context.message.user.profile.email,
        duration: details.duration
      })
    }).then(json => {
      const start = moment(json.startTime);
      const end = moment(json.endTime);
      return this.send(details.context, {
        text: `Okay I have booked you *${json.room.name}* from ${start.format("LT")} to ${end.format("LT")} (${start.to(end, true)})`,
        attachments: [ this.roomAttachment(json.room) ]
      });
    })
    .catch(error => {
      return this.send(details.context, "I was unable to book you a room :sadpanda:");
    });
  }

  listRoomsCommand(context) {
    return this.fetch(`${Config.meeting.server.url}/rooms`)
    .then(json => {
      const attachments = [];
      for (let room of Array.from(json)) { attachments.push(this.roomAttachment(room)); }
      return this.send(context, {
        text: ":house:",
        attachments
      }
      );
    });
  }

  instantBookCommand(context) {
    const id = this.queueRequest(context);
    return this.send(context, {
      text: `<@${context.message.user.id}> I will try to find a room for you, how much time do you need?`,
      attachments: [ this.buttonsAttachment(id, {name: "duration"}) ]
    });
  }

  isAuthorized(req, res) {
    let authorized;
    if (!(authorized = req.headers.authorization === `Basic ${Config.meeting.verification.token}`)) {
      if (!authorized) { this.robot.logger.debug("MeetingBot: invalid token provided"); }
      res.status(403).send("Not authorized");
    }
    return authorized;
  }

  confirmCheckin(json) {
    let success = true;
    const users = json.attendees.map(function(attendee) {
      let user;
      if (!(user = Utils.lookupChatUserByEmail(attendee))) {
        success = false;
      }
      return user;
    });

    const start = moment(json.startTime);
    const end = moment(json.endTime);

    for (let user of Array.from(users)) {
      if (user) {
        const buttons = this.buttonsAttachment(this.queueCheckin(json, user), {name: "status"});
        buttons.text = "Please confirm your attendance...";

        this.dm(user, {
          text: `\
You have \`${json.description}\` ${start.fromNow()}
starting at ${start.format("LT")} to ${end.format("LT")} for ${start.to(end, true)}\
`,
          attachments: [
            buttons,
            this.roomAttachment(json.room)
          ]
        });
      }
    }
    return success;
  }

  postMeetingCheckin(req, res) {
    if (req.body.id == null) { return res.status(400).send("Missing id"); }
    if (req.body.room == null) { return res.status(400).send("Missing room"); }
    if (req.body.description == null) { return res.status(400).send("Missing description"); }
    if (req.body.startTime == null) { return res.status(400).send("Missing startTime"); }
    if (req.body.endTime == null) { return res.status(400).send("Missing endTime"); }
    if (req.body.owner == null) { return res.status(400).send("Missing owner"); }
    if ((req.body.attendees == null) || !(req.body.attendees.length > 0)) { return res.status(400).send("Missing attendees"); }
    if (this.confirmCheckin(req.body)) {
      return res.send('OK');
    } else {
      return res.status(404).send("Unable to notify all attendees");
    }
  }
}
MeetingBot.initClass();

module.exports = MeetingBot;
