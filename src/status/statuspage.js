/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Description:
//  Interact with StatusPage via the API
//
// Dependencies:
//   - underscore
//
// Configuration:
//   HUBOT_STATUSPAGE_ID
//   HUBOT_STATUSPAGE_API_KEY
//
// Commands:
//   None
//
// Author:
//   ndaversa

const _ = require("underscore");
const Config = require("../config");
const Utils = require("../utils");

class StatusPage {

  static fetch(url, opts) {
    if (opts == null) { opts = {}; }
    let headers = {"Authorization": `OAuth ${Config.statuspage.token}`};
    headers = _(headers).extend(opts.headers);

    return Utils.fetch(url, _(opts).extend({headers}));
  }

  static resolveIncident(incident) {
    return StatusPage.fetch(`${Config.statuspage.url}/pages/${Config.statuspage.id}/incidents/${incident.statuspage.incident.id}.json`, {
      method: "PUT",
      body: JSON.stringify({incident: {status: "resolved"}})
    }
    );
  }

  static createIncident(incident) {
    return StatusPage.fetch(`${Config.statuspage.url}/pages/${Config.statuspage.id}/incidents.json`, {
      method: "POST",
      body: JSON.stringify({incident})
    }
    );
  }

  static fetchIncidents() {
    return StatusPage.fetch(`${Config.statuspage.url}/pages/${Config.statuspage.id}/incidents.json`);
  }

  static fetchComponents() {
    return StatusPage.fetch(`${Config.statuspage.url}/pages/${Config.statuspage.id}/components.json`);
  }
}

module.exports = StatusPage;

