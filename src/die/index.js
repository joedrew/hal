/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Kills hubot so it can be reborn like a phoenix from the ashes
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   die - forces hubot to restart
//
// Author:
//   ndaversa

const _ = require("underscore");
const Bot = require("../bot");

class DieBot extends Bot {

  constructor() {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.match(/return (?:_assertThisInitialized\()*(\w+)\)*;/)[1];
      eval(`${thisName} = this;`);
    }
    this.commands = [{
      regex: /die/i,
      name: "dieCommand"
    }
    ];
    super(...arguments);
  }

  dieCommand(context) {
    this.send(context, "https://www.youtube.com/watch?v=c8N72t7aScY");
    console.log("Received `die` command, exiting...");
    console.log("I'm scared Dave...  I'm scared.");
    return _.delay((() => process.exit(1)), 500);
  }
}

module.exports = DieBot;
