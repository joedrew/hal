/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Reads a birthday calendar and matches with Slack users
//  In turn, providing notifications on their birthdays
//
// Dependencies:
//   - underscore
//   - ical
//   - moment
//   - fuse.js
//   - cron
//
// Configuration:
//   HUBOT_BIRTHDAY_ICAL
//
// Commands:
//   hubot birthdays - Find out who has a birthday coming up
//
// Author:
//   ndaversa

const _ = require('underscore');
const moment = require('moment');
const ical = require('ical');
const cronJob = require("cron").CronJob;

const Bot = require("../bot");
const Config = require("../config");
const Utils = require("../utils");

class BirthdayBot extends Bot {
  static initClass() {
  
    this.prototype.upcomingBirthdays =  [];
  }

  constructor(robot) {
    super(...arguments);
    this.sendHappyBirthdayMessages = this.sendHappyBirthdayMessages.bind(this);
    this.refreshBirthdayList = this.refreshBirthdayList.bind(this);
    this.robot = robot;
    this.commands = [{
      regex: /birthdays/,
      name: "upcomingBirthdaysCommand"
    }
    ];
    this.robot.brain.once('loaded', () => {
      return new cronJob( "00 00 10 * * *", this.sendHappyBirthdayMessages, null, true);
    });
  }

  lookupUser(event) {
    const user = Utils.fuzzyFindChatUser(event.name);
    user.event = event;
    return user;
  }

  sendHappyBirthdayMessages() {
    return this.refreshBirthdayList(users => {
      let birthdays;
      const today = moment().startOf('day');
      return birthdays = users.map(user => {
        if (user.event.start.isSame(today, 'day')) {
          return this.send(user.id, "Happy birthday :balloon: :tada:");
        }
      });
    });
  }

  fetchUpcomingBirthdays(callback) {
    return ical.fromURL(Config.birthday.calendar.url, {}, (err, data) => {
      const start = moment().startOf('day');
      const end = moment().startOf('day').add(7, 'days').endOf('day');

      const birthdays = _(data).keys().map(function(id) {
        const event = data[id];
        return {
          start: moment(event.start),
          end: moment(event.end),
          summary: event.summary,
          id
        };}).filter(event => event.start.isBetween(start, end, null, '[]')).map(function(event) {
        event.name = event.summary.split('- Birthday')[0].trim();
        return event;}).map(this.lookupUser);
      return callback(_(birthdays).compact());
    });
  }

  refreshBirthdayList(callback) {
    this.robot.logger.debug('Refreshing birthday list');
    return this.fetchUpcomingBirthdays(users => {
      this.upcomingBirthdays = users || [];
      return (typeof callback === 'function' ? callback(this.upcomingBirthdays) : undefined);
    });
  }

  upcomingBirthdaysCommand(context) {
    return this.refreshBirthdayList(users => {
      const today = moment().startOf('day');
      const birthdays = users.map(user => {
        if (user.event.start.isSame(today, 'day')) {
          return `<@${user.id}>'s birthday is today :birthday:. Join me in wishing them a happy birthday!:balloon: :tada:`;
        } else {
          return `<@${user.id}>'s birthday is ${today.to(user.event.start)} on ${user.event.start.format("dddd MMMM Do")}`;
        }
      });
      if (birthdays.length > 0) {
        return this.send(context, `\
${birthdays.join("\n")}\
`
        );
      } else {
        return this.send(context, "There are no birthdays in the next 7 days :sadpanda:");
      }
    });
  }
}
BirthdayBot.initClass();

module.exports = BirthdayBot;
