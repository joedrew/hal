/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Track Device Sessions
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   None
//
// Author:
//   ndaversa

const crypto = require("crypto");

class Sessions {
  static initClass() {
  
    this.key = "trackerbot-sessions";
  }

  constructor(robot) {
    this.robot = robot;
    if (!(this instanceof Sessions)) { return new Sessions(this.robot); }
    this.robot.brain.once('loaded', () => {
      return this.sessions = this.robot.brain.get(Sessions.key) || {};
  });
  }

  save() {
    return this.robot.brain.set(Sessions.key, this.sessions);
  }

  all() { return this.sessions; }

  get(id) {
    if (!id) { return this.sessions; }
    return this.sessions[id];
  }

  end(details) {
    if (!details.id) { return this.sessions; }
    delete this.sessions[details.id];
    return this.save();
  }

  create(details) {
    details.time = Date.now();
    this.sessions[details.id] = details;
    this.save();
    return this.sessions[details.id];
  }
}
Sessions.initClass();

module.exports = Sessions;
