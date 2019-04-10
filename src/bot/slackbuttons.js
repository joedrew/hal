/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require("underscore");
const Utils = require("../utils");

module.exports = {
  initialize() {
    return this.robot.on("SlackEvents", (payload, res) => { //requires JiraBot @ 6.8.3 or greater
      if (!payload.handled && this.shouldBotHandle(payload) && this.isValid(payload)) {
        return this.onButtonActions(payload).then(() => res.json(payload.original_message)).catch(function(error) {
          return this.robot.logger.error(error);
        });
      }
    });
  },

  buttonsAttachment(id, query) {
    let actions;
    let button;
    if (_(query).isArray()) {
      actions = ((() => {
        const result = [];
        for (button of Array.from(query)) {           result.push(_(button).omit("func"));
        }
        return result;
      })());
    } else {
      actions = ((() => {
        const result1 = [];
        for (button of Array.from(_(this.slackButtons).where(query))) {           result1.push(_(button).omit("func"));
        }
        return result1;
      })());
    }

    return {
      fallback: "Unable to display quick action buttons",
      attachment_type: "default",
      callback_id: `${this.constructor.name}_${id}`,
      color: "#EDB431",
      actions
    };
  },

  isValid(payload) { return true; },

  onButtonActions(payload) {
    return Promise.all(payload.actions.map(action => {
      let button;
      Utils.Stats.increment(`slack.button.${this.constructor.name}.${action.name}.${action.value}`);
      if (button = _(this.slackButtons).findWhere({name: action.name})) {
        return button.func.call(this, payload, action);
      }
    })
    );
  },

  shouldBotHandle(payload) {
    if (payload.callback_id.indexOf(`${this.constructor.name}_`) === 0) {
      payload.callback_id = payload.callback_id.split(`${this.constructor.name}_`)[1];
      payload.handled = true;
      return true;
    }
    return false;
  }
};
