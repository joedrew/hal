/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  A bot that checks the health of the hubot
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

const Bot = require("../bot");
const Server = require("../bot/server");
const Config = require("../config");

class HealthBot extends Bot {
  static initClass() {
    this.include(Server); //TODO: don't need auth on this endpoint
  
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
    if (!(this instanceof HealthBot)) { return new HealthBot(this.robot); }
    this.endpoints = [{
      path: "/healthz",
      type: "get",
      func: this.getHealthz
    }
    ];
    super(...arguments);
  }

  isAuthorized() { return true; }

  getHealthz(req, res) {
    return res.json({});
    return this.fetch("https://slack.com/api/users.getPresence", {
      querystring: true,
      user: this.robot.adapter.self.id
    }).then(json => {
      if (json.presence === "active") {
        return res.json(json);
      } else {
        return res.status(500).send(`${this.robot.name} is offline`);
      }
    }).catch(error => {
      res.status(500).send(`${this.robot.name} is offline`);
      this.robot.logger.error(`${this.robot.name} is offline`);
      return this.robot.logger.error(error);
    });
  }
}
HealthBot.initClass();

module.exports = HealthBot;
