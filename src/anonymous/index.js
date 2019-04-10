/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Send a message to a channel anonymously
//
// Dependencies:
//   - underscore
//
// Configuration:
//   None
//
// Commands:
//   anonymous <channel> <message>
//
// Author:
//   ndaversa

const _ = require("underscore");
const Bot = require("../bot");
const Config = require("../config");
const Utils = require("../utils");

class AnonymousBot extends Bot {

  constructor() {
    {
      // Hack: trick Babel/TypeScript into allowing this before super.
      if (false) { super(); }
      let thisFn = (() => { return this; }).toString();
      let thisName = thisFn.match(/return (?:_assertThisInitialized\()*(\w+)\)*;/)[1];
      eval(`${thisName} = this;`);
    }
    this.commands = [{
      regex: /(?:anon|anonymous) #?([a-z0-9_-]{1,21})([^]+)/i,
      name: "askCommand"
    }
    ];
    super(...arguments);
  }

  askCommand(context) {
    const [ __, name, message ] = Array.from(context.match);
    const channels = [];

    const destination = Utils.getRoom(name);
    for (let c of Array.from(Config.anonymous.channels)) {
      const room = Utils.getRoom(c);
      if (room) { channels.push(` <\#${room.id}|${room.name}>`); }
    }
    if (!destination || !_(Config.anonymous.channels).contains(name)) { return context.reply(`You can only send anonymous messages to ${channels}`); }

    return this.send(destination, message);
  }
}

module.exports = AnonymousBot;
