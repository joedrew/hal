/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//   This bootstraps the hubot and loads all add-on bots
//
// Commands:
//   hal birthdays - Find out who has a birthday coming up
//   hal book a room - quickly book a meeting room for use right now
//   hal calendar link for @<group> - Will provide a vacation calendar for the specified user group (see slack directory)
//   hal die - forces hubot to restart
//   hal idea <idea summary>
//   hal on vacation - Find out who's on vacation right now

require('events').EventEmitter.prototype._maxListeners = 20; // Raise the max event emitter limit

const bots = {
  Anonymous: require("../src/anonymous"),
  Birthday: require("../src/birthday"),
  Calendar: require("../src/calendar"),
  Die: require("../src/die"),
  Fuzzy: require("../src/fuzzy"),
  Health: require("../src/health"),
  Idea: require("../src/idea"),
  Meeting: require("../src/meeting"),
  Status: require("../src/status"),
  Topic: require("../src/topic"),
  Tracker: require("../src/tracker"),
  Vacation: require("../src/vacation")
};

module.exports = function(robot) {
  robot.logger.debug("Booting bots...");
  return (() => {
    const result = [];
    for (let name in bots) {
      const bot = bots[name];
      robot.logger.debug(`Initializing ${name}`);
      new bot(robot);
      result.push(robot.logger.debug(`${name} Ready`));
    }
    return result;
  })();
};
