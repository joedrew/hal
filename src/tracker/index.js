/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  A bot that exposes an API to register and track test devices
//
// Dependencies:
//   - underscore
//   - node-fetch
//
// Configuration:
//   HUBOT_TRACKER_VERIFICATION_TOKEN
//
// Commands:
//   None
//
// Author:
//   ndaversa

const _ = require("underscore");
const s = require("underscore.string");
const moment = require("moment");

const Bot = require("../bot");
const SlackButtons = require("../bot/slackbuttons");
const Server = require("../bot/server");
const Config = require("../config");
const Utils = require("../utils");
const Devices = require("../tracker/devices");
const Sessions = require("../tracker/sessions");
const crypto = require("crypto");

class TrackerBot extends Bot {
  static initClass() {
    this.include(Server);
    this.include(SlackButtons);
  }

  constructor(robot) {
    super(...arguments);
    this.robot = robot;
    if (!(this instanceof TrackerBot)) { return new TrackerBot(this.robot); }

    this.endpoints = [{
      path: "/hubot/tracker/device/register",
      type: "post",
      func: this.postDeviceRegister
    }
    , {
      path: "/hubot/tracker/device/pushtoken",
      type: "post",
      func: this.postDevicePushToken
    }
    , {
      path: "/hubot/tracker/device/session/start",
      type: "post",
      func: this.postDeviceSessionStart
    }
    , {
      path: "/hubot/tracker/device/session/end",
      type: "post",
      func: this.postDeviceSessionEnd
    }
    ];

    this.commands = [{
      regex: /device list/i,
      name: "deviceListCommand"
    }
    , {
      regex: /device sessions/i,
      name: "deviceSessionsCommand"
    }
    ];

    this.pingButton = { 
      name: "ping",
      text: "Ping",
      type: "button",
      style: "primary",
      func: this.onPingButtonAction
    };

    this.deleteButton = { 
      name: "delete",
      text: "Delete",
      type: "button",
      style: "danger",
      func: this.onDeleteButtonAction
    };

    this.slackButtons = [ this.pingButton, this.deleteButton ];
    this.devices = new Devices(this.robot);
    this.sessions = new Sessions(this.robot);
  }

  isValid(payload) {
    try {
      let device;
      if (device = this.devices.get(payload.callback_id)) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  isAuthorized(req, res) {
    let authorized;
    if (!(authorized = req.headers.authorization === `Basic ${Config.tracker.verification.token}`)) {
      if (!authorized) { this.robot.logger.debug("Device Tracker: invalid token provided"); }
      res.status(403).send("Not authorized");
    }
    return authorized;
  }

  postDeviceRegister(req, res) {
    const response = this.register(req.body);
    return res.json(response);
  }

  postDevicePushToken(req, res) {
    return res.send('OK');
  }

  postDeviceSessionStart(req, res) {
    if (req.body.id == null) { return res.status(400).send("Missing id"); }
    if (req.body.name == null) { return res.status(400).send("Missing name"); }
    if (req.body.email == null) { return res.status(400).send("Missing email"); }
    const response = this.createSession(req.body);
    return res.json(response);
  }

  postDeviceSessionEnd(req, res) {
    if (req.body.id == null) { return res.status(400).send("Missing id"); }
    if (req.body.name == null) { return res.status(400).send("Missing name"); }
    if (req.body.email == null) { return res.status(400).send("Missing email"); }
    this.endSession(req.body);
    return res.send('OK');
  }

  onPingButtonAction(payload, action) {
    const { user } = payload;
    const msg = payload.original_message;
    const device = this.devices.get(payload.callback_id);
    const session = this.sessions.get(payload.callback_id);
    const holder = Utils.lookupChatUserByEmail(session.email);

    msg.attachments.push({
      text: `<@${user.id}> pinged <@${holder.id}> about this device`});
    return this.send({message: {room: holder.id}}, {
      text: `<@${user.id}> is looking for a device you last had`,
      attachments: [ this.deviceAttachment(device) ]
    });
  }

  onDeleteButtonAction(payload, action) {
    let actionAttachment;
    const msg = payload.original_message;
    const device = this.devices.get(payload.callback_id);
    const session = this.sessions.get(payload.callback_id);

    if (actionAttachment = _(msg.attachments).find({callback_id: device.id})) {
      this.devices.remove(device);
      this.sessions.end(session);
      const index = _(msg.attachments).indexOf(actionAttachment) - 1;
      const deviceAttachment = msg.attachments[index];
      return msg.attachments = _(msg.attachments).without(actionAttachment, deviceAttachment);
    } else {
      return msg.attachments.push({
        text: `Cannot delete device ${device.id}`});
    }
  }

  register(device) {
    const id = crypto.createHash("md5").update(`${device.physical_id}`).digest("hex").substr(0, 7);
    device.id = id;
    this.devices.add(device);
    return device;
  }

  createSession(user) {
    let session;
    return session = this.sessions.create(user);
  }

  endSession(user) {
    return this.sessions.end(user);
  }

  sessionAttachment(user, device, session) {
    return _(this.deviceAttachment(device)).extend({
      author_name: user.real_name,
      author_icon: user.slack.profile.image_512,
      fields: [{
        title: "Checked out",
        value: moment(session.time).fromNow(),
        short: true
      }
      ]});
  }

  deviceAttachment(device) {
    return {
      color: "#A4C639",
      title: `:iphone: ${s.capitalize(device.manufacturer)} [${device.model}] - ${device.os} [SDK ${device.sdk}] - ${device.id}`
    };
  }

  deviceSessionsCommand(context) {
    const attachments = [];

    const object = this.sessions.all();
    for (let id in object) {
      const session = object[id];
      const device = this.devices.get(id);
      const user = Utils.lookupChatUserByEmail(session.email) ||{
        real_name: session.name,
        slack: { profile: {image_512: ""}
      }
      };

      attachments.push(this.sessionAttachment(user, device, session));
      attachments.push(this.buttonsAttachment(device.id, [ _(this.pingButton).extend({value: user.id}) ]));
    }

    if (attachments.length === 0) {
      return this.send(context, "No active sessions");
    } else {
      return this.send(context, {attachments});
    }
  }

  deviceListCommand(context) {
    try {
      const attachments = [];

      const object = this.devices.all();
      for (let id in object) {
        const device = object[id];
        attachments.push(this.deviceAttachment(device));
        attachments.push(this.buttonsAttachment(device.id, [ _(this.deleteButton).extend({value: device.id}) ]));
      }

      if (attachments.length === 0) {
        return this.send(context, "No Devices :sadpanda:");
      } else {
        console.log(attachments);
        return this.send(context, {
          text: ":android: :iphone:",
          attachments
        }
        );
      }
    } catch (e) {
      return console.log(e);
    }
  }
}
TrackerBot.initClass();

module.exports = TrackerBot;
