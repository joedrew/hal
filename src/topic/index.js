/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
// Read an ical feed and prepend the current event to the channel topic
//
// Dependencies:
// - coffee-script
// - moment
// - cron
// - ical
// - underscore
//
// Configuration:
// HUBOT_ICAL_CHANNEL_MAP `\{\"ops\":\"HTTP_ICAL_LINK\",\"data\":\"HTTP_ICAL_LINK\"\}`
// HUBOT_ICAL_LABEL_CHANNEL_MAP `\{\"ops\":\"On\ duty\"\,\"engineering\":\"Oncall\"\}`
// HUBOT_ICAL_DUPLICATE_RESOLVER - When finding multiple events for `now` use the presence of this string to help choose winner
//    Note: Default value is `OVERRIDE: ` to handle calendars like VictorOps
// HUBOT_ICAL_CRON_JOB - How often to check for updates in cron time, default `0 */15 * * * *` which is every 15 mins everyday
//
// Commands:
//   None
//
// Author:
//   ndaversa

const _ = require('underscore');
const cronJob = require("cron").CronJob;
const ical = require('ical');
const moment = require('moment');

const Bot = require("../bot");
const Config = require("../config");
const Utils = require("../utils");

class TopicBot extends Bot {

  constructor(robot) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.match(/return (?:_assertThisInitialized\()*(\w+)\)*;/)[1];
      eval(`${thisName} = this;`);
    }
    this.robot = robot;
    this.commands = [{
      regex: /topic refresh/,
      name: "topicRefreshCommand"
    }
    , {
      regex: /topic (.*)/,
      name: "topicChangeCommand"
    }
    ];
    super(...arguments);

    this.robot.brain.once('loaded', () => {
      new cronJob(Config.topic.cronTime, this.updateTopics.bind(this), null, true);
      return this.updateTopics();
    });
  }

  currentEvent(room, cb) {
    const now = moment();
    const calendar = Config.topic.calendars[room];
    return ical.fromURL(calendar, {}, function(err, data) {
      let event;
      let events = _(data).keys().map(function(id) {
        const event = data[id];
        return {
          start: moment(event.start),
          end: moment(event.end),
          summary: event.summary,
          id
        };}).filter(event => now.isBetween(event.start, event.end));

      if (events.length === 1) {
        event = events[0];
      } else {
        events = events.filter(event => event.summary.indexOf(Config.topic.duplicateResolution) > -1);
        if (events.length === 1) {
          event = events[0];
        }
      }

      if (event != null) { event.summary = event.summary.replace(Config.topic.duplicateResolution, ''); }
      return cb(event);
    });
  }

  updateTopicForRoom(room) {
    const label = Config.topic.labels[room];
    const channel = Utils.getRoom(room);
    return Utils.getRoomTopic(channel.id, channel.getType())
    .then(room => {
      const currentTopic = room.topic;
      return this.currentEvent(room.name, function(event) {
        let summary;
        let format = "__LABEL__: __EVENT__ | __LEFTOVER__";
        const regex = new RegExp(Config.topic.regex.replace("__LABEL__", label), "i");
        const [ __, ___, leftover ] = Array.from(currentTopic.match(regex));

        if (event) {
          let user;
          if ((event.summary != null ? event.summary.length : undefined) > 0) { user = Utils.fuzzyFindChatUser(event.summary); }
          if (user != null) { summary = `@${user.name}`; }
          if (summary == null) { ({ summary } = event); }
        } else {
          format = "__LEFTOVER__";
        }

        const topic =
          format
          .replace("__LABEL__", label)
          .replace("__EVENT__", summary)
          .replace("__LEFTOVER__", leftover);

        if (topic !== currentTopic) {
          return Utils.setTopic(channel.id, topic);
        }
      });
    });
  }

  updateTopics() {
    return (() => {
      const result = [];
      for (let room in Config.topic.calendars) {
        result.push(this.updateTopicForRoom(room));
      }
      return result;
    })();
  }

  topicRefreshCommand(context) {
    context.finish();
    const room = Utils.getRoom(context.message.room);
    this.send(context, "Refreshing topics");
    return this.updateTopics();
  }

  topicChangeCommand(context) {
    const [ __, topic ] = Array.from(context.match);
    const room = Utils.getRoom(context.message.room);
    this.send(context, `Setting topic for <#${room.id}|${room.name}> to \`${topic}\``);
    return Utils.setTopic(room.id, topic);
  }
}

module.exports = TopicBot;
