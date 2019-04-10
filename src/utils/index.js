/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let c;
const _ = require("underscore");
const cache = require("memory-cache");
const fetch = require("node-fetch");
const icalendar = require("icalendar");
const Fuse = require('fuse.js');
const Config = require("../config");
const { StatsD } = require('node-dogstatsd');

if (Config.stats.host && Config.stats.port) {
  c = new StatsD(Config.stats.host, Config.stats.port);
}

class Utils {
  static initClass() {
  
    this.robot = null;
  
    this.cache = {
      put(key, value, time) { if (time == null) { time = Config.cache.expiry; } return cache.put(key, value, time); },
      get: cache.get,
      del: cache.del
    };
  
    this.Stats = {
      increment(label, tags) {
        try {
          label = label
            .replace( /[\/\(\)-]/g, '.' ) //Convert slashes, brackets and dashes to dots
            .replace( /[:\?]/g, '' ) //Remove any colon or question mark
            .replace( /\.+/g, '.' ) //Compress multiple periods into one
            .replace( /\.$/, '' ); //Remove any trailing period
  
          if (Config.debug) { console.log(`${Config.stats.prefix}.${label}`, tags); }
          if (c) { return c.increment(`${Config.stats.prefix}.${label}`, tags); }
        } catch (e) {
          return console.error(e);
        }
      }
    };
  }

  static fetch(url, opts) {
    let options = {
      headers: {
        "Content-Type": "application/json"
      }
    };
    options = _(options).extend(opts);

    Utils.robot.logger.debug(`Fetching: ${url}`);
    return fetch(url,options).then(function(response) {
      if ((response.status >= 200) && (response.status < 300)) {
        return response;
      } else {
        const error = new Error(`${response.statusText}: ${response.url.split("?")[0]}`);
        error.response = response;
        throw error;
      }}).then(function(response) {
      const length = response.headers.get('content-length');
      if ((length !== "0") && (length !== 0) && (response.status !== 204)) { return response.json(); }}).catch(function(error) {
      Utils.robot.logger.error(error);
      Utils.robot.logger.error(error.stack);
      try {
        return error.response.json().then(function(json) {
          Utils.robot.logger.error(JSON.stringify(json));
          let message = `\n\`${error}\``;
          for (let k in json.errors) { const v = json.errors[k]; message += `\n\`${v}\``; }
          throw message;
        });
      } catch (e) {
        throw error;
      }
    });
  }

  static normalizeContext(context) {
    let normalized;
    if (_(context).isString()) {
      normalized = {message: {room: context}};
    } else if (context != null ? context.room : undefined) {
      normalized = {message: context};
    } else if (__guard__(context != null ? context.message : undefined, x => x.room)) {
      normalized = context;
    }
    return normalized;
  }

  static getRoom(context) {
    context = this.normalizeContext(context);
    let room = this.robot.adapter.client.rtm.dataStore.getChannelOrGroupByName(context.message.room);
    if (!room) { room = this.robot.adapter.client.rtm.dataStore.getChannelGroupOrDMById(context.message.room); }
    if (!room) { room = this.robot.adapter.client.rtm.dataStore.getDMByUserId(context.message.room); }
    if (!room) { room = this.robot.adapter.client.rtm.dataStore.getDMByName(context.message.room); }
    return room;
  }

  static getRoomName(context) {
    const room = this.getRoom(context);
    return room.name;
  }

  static getUsers() {
    return this.robot.adapter.client.rtm.dataStore.users;
  }

  static lookupChatUser(username) {
    const users = Utils.getUsers();
    const result = ((() => {
      const result1 = [];
      for (let user in users) {
        if (users[user].name === username) {
          result1.push(users[user]);
        }
      }
      return result1;
    })());
    if ((result != null ? result.length : undefined) === 1) {
      return result[0];
    }
    return null;
  }

  static lookupChatUserByEmail(email) {
    const users = Utils.getUsers();
    const result = ((() => {
      const result1 = [];
      for (let user in users) {
        if (users[user].email_address === email) {
          result1.push(users[user]);
        }
      }
      return result1;
    })());
    if ((result != null ? result.length : undefined) === 1) {
      return result[0];
    }
    return null;
  }

  static authorizeUser(msg, usergroup) {
    return Utils.fetch(`https://slack.com/api/usergroups.users.list?token=${Config.slack.token}&usergroup=${usergroup}`)
    .then(function(json) {
      if (!_(json.users).contains(msg.message.user.id)) {
        throw `You are not authorized to use this feature, you must be part of the <!subteam^${usergroup}> group. Please visit <#C06RDDDC4> to make your case for permission`;
      }}).catch(function(error) {
      msg.send(`<@${msg.message.user.id}> ${error}`);
      return Promise.reject(error);
    });
  }

  static getUsersInGroup(usergroup) {
    let users;
    if ((users = Utils.cache.get(`Utils:getUsersInGroup:${usergroup}`))) {
      return Promise.resolve(users);
    } else {
      return Utils.fetch(`https://slack.com/api/usergroups.users.list?token=${Config.slack.token}&usergroup=${usergroup}`)
      .then(json => {
        users = json.users.map(user => {
          return Utils.getUsers()[user];
      });
        Utils.cache.put(`Utils:getUsersInGroup:${usergroup}`, users, Config.cache.usergroups.users.expiry);
        return users;
      });
    }
  }

  static getGroupInfo(usergroup) {
    let groupList, json;
    if ((json = Utils.cache.get("Utils:getGroupInfo"))) {
      groupList =  Promise.resolve(json);
    } else {
      groupList = 
        Utils.fetch(`https://slack.com/api/usergroups.list?token=${Config.slack.token}`)
        .then(function(json) {
          Utils.cache.put("Utils:getGroupInfo", json, Config.cache.usergroups.list.expiry);
          return json;
        });
    }

    return groupList.then(function(json) {
      let group = _(json.usergroups).findWhere({id: usergroup});
      if (!group) { group = _(json.usergroups).findWhere({handle: usergroup}); }
      return group;
    });
  }

  static getCalendarFromURL(url) {
    let body;
    if ((body = Utils.cache.get(`Utils:getCalendarFromURL:${url}`))) {
      return Promise.resolve(icalendar.parse_calendar(body));
    } else {
      return fetch(url)
      .then(res => {
        return res.text();
    }).then(body => {
        Utils.cache.put(`Utils:getCalendarFromURL:${url}`, body, Config.cache.calendar.expiry);
        return icalendar.parse_calendar(body);
      });
    }
  }

  static getCalendarsFromURLs(urls) {
    return Promise.all(
      urls.map(url => Utils.getCalendarFromURL(url))
    );
  }

  static fuzzyFindChatUser(name, users) {
    let results;
    if (users == null) { users = Utils.getUsers(); }
    users = _(users).keys().map(function(id) {
      const u = users[id];
      if (!u.deleted && !u.is_bot && (u.profile.email != null ? u.profile.email.includes('@ecobee') : undefined)) {
        return {
          id: u.id,
          name: u.profile.display_name.toLowerCase() || u.profile.real_name.toLowerCase(),
          real_name: u.real_name.toLowerCase(),
          email: (u.profile.email != null ? u.profile.email.split('@')[0].toLowerCase() : undefined) || ''
        };
      } else {
        return null;
      }
    });
    users = _(users).compact();

    const f = new Fuse(users, {
      keys: [{
        name: "name",
        weight: 0.2
      }
      , {
        name: "real_name",
        weight: 0.8
      }
      ],
      shouldSort: true,
      verbose: false
    }
    );
    if (name) { results = f.search(name.replace(/\W+/g, " ")); }
    const result = (results != null) && (results.length >=1) ? results[0] : null;
    Utils.robot.logger.debug(`Matching \`${name}\` with @${(result != null ? result.name : undefined)}`);
    return result;
  }

  static getRoomTopic(id, type) {
    return this.robot.adapter.client.web[`${type}s`].info(id)
    .then(details =>
      ({
        topic: details[type].topic.value,
        name: details[type].name,
        id: details[type].id
      })
    );
  }

  static setTopic(id, topic) {
    let endpoint;
    topic = _(topic).unescape();
    const opts = { 
      channel: id,
      topic: encodeURIComponent(topic),
      token: Config.slack.token
    };

    switch (id[0]) {
      case "G":
        endpoint = "groups";
        break;
      case "C":
        endpoint = "channels";
        break;
      default:
        return Promise.reject();
    }

    const qs = ((() => {
      const result = [];
      for (let key in opts) {
        const value = opts[key];
        result.push(`${key}=${value}`);
      }
      return result;
    })()).join("&");
    return Utils.fetch(`https://slack.com/api/${endpoint}.setTopic?${qs}`)
    .catch(error => {
      return Utils.robot.logger.error(`An error occured trying to update the Jedi channel topic ${error}`);
    });
  }
}
Utils.initClass();

Utils.Stats.increment("boot");
module.exports = Utils;

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}