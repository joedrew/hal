/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Test the fuzzy matching function quickly
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   fuzzy <name> - to test the fuzzy matching function
//
// Author:
//   ndaversa

const Bot = require("../bot");
const Utils = require("../utils");

class FuzzyBot extends Bot {

  constructor() {
    super(...arguments);
    this.commands = [{
      regex: /fuzzy (.*)/i,
      name: "fuzzyCommand"
    }
    ];
  }

  fuzzyCommand(context) {
    const [ __, name ] = Array.from(context.match);
    return this.send(context, `\
Match for \`${name}\`
\`\`\`${JSON.stringify(Utils.fuzzyFindChatUser(name))}\`\`\`\
`
    );
  }
}

module.exports = FuzzyBot;
