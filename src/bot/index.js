/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require("underscore");
const Utils = require("../utils");

class Bot {
  constructor(robot, commands) {
    this.robot = robot;
    if (this._initializers) { for (let cb of Array.from(this._initializers)) { cb.call(this); } }
    if (!Utils.robot) { Utils.robot = this.robot; }

    for (let command of Array.from(commands)) {
      Utils.robot.logger.debug("Registering Command:", command);

      if (command.listen) {
        this.robot.listen(command.listen.bind(this), command.func.bind(this));
      } else {
        const func = (command => function() {
          Utils.Stats.increment(`command.${command.name}`);
          return this[command.name].apply(this, arguments);
        }.bind(this))(command);

        if (command.hear) {
          this.hear(command.regex, command.usergroup, func);
        } else {
          this.respond(command.regex, command.usergroup, func);
        }
      }
    }
  }

  normalizeContext(context) {
    let normalized;
    if (_(context).isString()) {
      normalized = {message: {room: context}};
    } else if (context != null ? context.room : undefined) {
      normalized = {message: context};
    } else if (__guard__(context != null ? context.message : undefined, x => x.room)) {
      normalized = context;
    } else if ((context != null ? context.id : undefined) != null) {
      normalized = {message: {room: context.id}};
    }
    return normalized;
  }

  send(contexts, message) {
    if (!_(contexts).isArray()) { contexts = [contexts]; }
    return (() => {
      const result = [];
      for (let context of Array.from(contexts)) {
        let payload = {text: ""};
        context = this.normalizeContext(context);

        if (_(message).isString()) {
          payload.text = message;
        } else {
          payload = _(payload).chain().extend(message).pick("text", "attachments").value();
        }

        if (((payload.attachments != null ? payload.attachments.length : undefined) > 0) && (payload.text.length === 0)) { payload.text = " "; }
        if (payload.text.length > 0) {
          result.push(this.robot.adapter.send({ 
            room: context.message.room,
            message: { thread_ts: context.message.thread_ts
          }
          }
          , payload));
        } else {
          result.push(undefined);
        }
      }
      return result;
    })();
  }

  dm(users, message) {
    if (!_(users).isArray()) { users = [ users ]; }
    return Array.from(users).filter((user) => user).map((user) =>
      this.send({message: {room: user.id}}, message));
  }

  fetch(url, opts) {
    if (opts == null) { opts = {}; }
    if ((this.credentials != null ? this.credentials.token : undefined) != null) { opts.token = this.credentials.token; }

    if (opts.querystring) {
      delete opts.querystring;
      const qs = ((() => {
        const result = [];
        for (let key in opts) {
          const value = opts[key];
          result.push(`${key}=${value}`);
        }
        return result;
      })()).join("&");
      this.robot.logger.debug(`Fetching: ${url}?${qs}`);
      return Utils.fetch(`${url}?${qs}`);
    } else {
      this.robot.logger.debug(`Fetching: ${url} with ${JSON.stringify(opts)}`);
      return Utils.fetch(url, opts);
    }
  }

  authorize(context, usergroup=null) {
    let auth;
    if (usergroup) {
      return auth = Utils.authorizeUser(context, usergroup);
    } else {
      return auth = Promise.resolve();
    }
  }

  hear(regex, usergroup=null, cb) {
    return this.robot.hear(regex, context => {
      return this.authorize(context, usergroup)
      .then(() => {
        return cb(context);
    }).catch(error => {
        this.robot.logger.error(error);
        this.robot.logger.error(error.stack);
        return this.send(context, `<@${context.message.user.id}>: ${error}`);
      });
    });
  }

  respond(regex, usergroup=null, cb) {
    return this.robot.respond(regex, context => {
      return this.authorize(context, usergroup)
      .then(() => {
        return cb(context);
    }).catch(error => {
        this.robot.logger.error(error);
        this.robot.logger.error(error.stack);
        return this.send(context, `<@${context.message.user.id}>: ${error}`);
      });
    });
  }

  static include(obj) {
    const excluded = ['extended', 'included', 'initialize'];

    for (let key in obj) {
      const value = obj[key];
      if (!Array.from(excluded).includes(key)) {
        this.prototype[key] = value;
      }
    }

    if (obj.initialize != null) {
      if (!this.prototype._initializers) { this.prototype._initializers = []; }
      this.prototype._initializers.push(obj.initialize);
    }
    if (obj.included != null) {
      obj.included.apply(this);
    }
    return this;
  }
}

module.exports = Bot;

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
