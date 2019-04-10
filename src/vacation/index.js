/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Reads a vacation calendar and matches schedules with Slack users
//  In turn, providing notifications when are mentioned but on vacation
//
// Dependencies:
//   - underscore
//   - ical
//   - moment
//   - fuse.js
//   - cron
//
// Configuration:
// HUBOT_VACATION_ICAL
//
// Commands:
//   hubot on vacation - Find out who's on vacation right now
//
// Author:
//   ndaversa

const _ = require('underscore');
const moment = require('moment');
const ical = require('ical');
const cronJob = require("cron").CronJob;
const Obfuscator = require('../utils/obfuscator');
const obfuscator = new Obfuscator(Obfuscator.PerfectObfuscator);

const Bot = require("../bot");
const Config = require("../config");
const Utils = require("../utils");

class VacationBot extends Bot {
  static initClass() {
  
    this.prototype.onVacationUsers =  [];
    this.prototype.onVacationRegex = null;
  }

  constructor(robot) {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.match(/return (?:_assertThisInitialized\()*(\w+)\)*;/)[1];
      eval(`${thisName} = this;`);
    }
    this.refreshVacationList = this.refreshVacationList.bind(this);
    this.robot = robot;
    this.commands = [{
      regex: new RegExp(`^(?:Reminder:(?: ${this.robot.name})?|${this.robot.name}) (who\\s?is )?on vacation\\.?$`),
      hear: true,
      name: "whoisOnVacationCommand"
    }
    , {
      listen: this.wasUserOnVacationMentioned,
      func:  this.userOnVacationMentioned
    }
    ];
    this.robot.brain.once('loaded', () => {
      new cronJob( "0 0 * * * *", this.refreshVacationList, null, true);
      return this.refreshVacationList(function(users) {
        return this.robot.logger.info(`Users on vacation: ${users.map(u => `@${u.name}`).join(", ")}`);
      });
    });
    super(...arguments);
  }

  lookupUser(event) {
    const user = Utils.fuzzyFindChatUser(event.name);
    if (user != null) {
      user.event = event;
    } else {
      this.robot.logger.error(`VacationBot: Cannot find ${event.name}`);
    }
    return user;
  }

  shouldNotifyOfVacation(context, user) {
    const { room } = context.message;
    const key = `${room}:${user.id}`;

    if (Utils.cache.get(key)) {
      this.robot.logger.info(`Supressing vacation mention for ${user.name} in ${room}`);
      return false;
    } else {
      Utils.cache.put(key, true);
      return true;
    }
  }

  nextWeekday(date) {
    switch (date.weekday()) {
      case 0: return date.weekday(1); // sunday > monday
      case 6: return date.weekday(8); // saturday > monday
      default: return date;
    }
  }

  determineWhosOnVacation(callback) {
    const now = moment();
    return ical.fromURL(Config.vacation.calendar.url, {}, (err, data) => {
      const onVacation = _(data).keys().map(function(id) {
        const event = data[id];
        return {
          start: moment(event.start),
          end: moment(event.end),
          summary: event.summary,
          id
        };}).filter(event => now.isBetween(event.start, event.end)).map(function(event) {
        event.name = event.summary.split(/\(.*\)/)[0].trim();
        return event;}).map(this.lookupUser);
      return callback(_(onVacation).compact());
    });
  }

  refreshVacationList(callback) {
    this.robot.logger.debug('Refreshing vacation list');
    return this.determineWhosOnVacation(users => {
      if (users && (users.length > 0)) {
        this.onVacationUsers = users;
        this.onVacationRegex = new RegExp(`\\b(${(users.map(user => user.name)).join('|')})\\b`, "gi");
      } else {
        this.onVacationUsers = [];
        this.onVacationRegex = null;
      }
      return (typeof callback === 'function' ? callback(this.onVacationUsers) : undefined);
    });
  }

  wasUserOnVacationMentioned(context) {
    if (!this.onVacationRegex) { return false; }
    if ((context.match == null)) { return false; }
    if (!context.user.id) { return false; }
    return context.match(this.onVacationRegex);
  }

  userOnVacationMentioned(context) {
    return (() => {
      const result = [];
      for (var username of Array.from(context.match)) {
        username = username.toLowerCase();
        const user = _(this.onVacationUsers).find(user => user.name === username);
        const date = this.nextWeekday(user.event.end);
        if (this.shouldNotifyOfVacation(context, user)) {
          result.push(this.send(context, `\
<@${context.message.user.id}>: \
${obfuscator.obfuscate(user.name)} is on vacation \
returning ${ date.fromNow() } \
on ${ date.format('dddd MMMM Do') } :sunglasses:\
`
          ));
        } else {
          result.push(undefined);
        }
      }
      return result;
    })();
  }

  whoisOnVacationCommand(context) {
    return this.refreshVacationList(users => {
      const vacationers = users.map(user => {
        const date = this.nextWeekday(user.event.end);
        return `\`${obfuscator.obfuscate(user.name)}\` is on vacation returning *${ date.fromNow() }* on _${ date.format('dddd MMMM Do') }_`;
      });
      if (vacationers.length > 0) {
        return this.send(context, `\
:beach_with_umbrella: :sunglasses:

${vacationers.join("\n")}\
`
        );
      } else {
        return this.send(context, "No one is on vacation :sadpanda:");
      }
    });
  }
}
VacationBot.initClass();

module.exports = VacationBot;
