/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Interact with Zendesk via the API
//
// Dependencies:
//   - underscore
//
// Configuration:
//   HUBOT_ZENDESK_TOKEN
//   HUBOT_ZENDESK_URL
//   HUBOT_ZENDESK_USERNAME
//
// Commands:
//   None
//
// Author:
//   ndaversa

const _ = require("underscore");
const Config = require("../config");
const Utils = require("../utils");

class Zendesk {
  static initClass() {
    this.robot = null;
  }

  static fetch(url, opts) {
    if (opts == null) { opts = {}; }
    let headers = {
      "Authorization": `Basic ${new Buffer(`${Config.zendesk.username}/token:${Config.zendesk.token}`).toString('base64')}`,
      "Content-Type": "application/json"
    };

    headers = _(headers).extend(opts.headers);

    return Utils.fetch(url, _(opts).extend({headers}));
  }

  static makeUrl(article) {
    return `https://EXAMPLE.COM/hc/en-us/articles/${article.id}`;
  }

  static activateArticle(article) {
    return Zendesk.fetch(`${Config.zendesk.url}/help_center/articles/${article.id}/translations/en-us.json`, {
      method: "PUT",
      body: JSON.stringify({translation: {draft: false}})
    }
    );
  }

  static deactivateArticle(article) {
    return Zendesk.fetch(`${Config.zendesk.url}/help_center/articles/${article.id}/translations/en-us.json`, {
      method: "PUT",
      body: JSON.stringify({translation: {draft: true}})
    }
    );
  }

  static removeArticle(article) {
    return Zendesk.fetch(`${Config.zendesk.url}/help_center/articles/${article.id}.json`,
      {method: "DELETE"})
    .then(function(json) {
      Zendesk.robot.emit("ZendeskArticleDeleted", json);
      return json;
    });
  }

  static createArticle(description) {
    return Zendesk.fetch(`${Config.zendesk.url}/help_center/sections/${Config.zendesk.section}/articles.json`, {
      method: "POST",
      body: JSON.stringify({
        article: {
          title: description,
          draft: true,
          label_names: ["ios", "android", "hal"],
          locale: "en-us"
        }
      })
    }).then(function(json) {
      Zendesk.robot.emit("ZendeskArticleCreated", json);
      return json;
    });
  }

  static fetchArticles() {
    return Zendesk.fetch(`${Config.zendesk.url}/help_center/sections/${Config.zendesk.section}/articles.json`);
  }
}
Zendesk.initClass();

module.exports = Zendesk;
